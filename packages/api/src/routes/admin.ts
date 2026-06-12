import {
  ADMIN_JWT_EXPIRY_SECONDS,
  AdminLoginSchema,
  AnalyticsFilterSchema,
  BulkPhotoActionSchema,
  PHOTO_STATUSES,
  PhotoFilterSchema,
  PixfeteErr,
  UpdateSettingsSchema,
  coordsFromMapUrl,
  coordsFromText,
} from "@pixfete/shared"
import type { AnalyticsEventRow, DashboardStats, UploaderStats } from "@pixfete/shared"
import bcrypt from "bcryptjs"
import { and, count, desc, eq, gte, inArray, max, min, sql } from "drizzle-orm"
import { Elysia } from "elysia"
import { Result as R } from "tsentials/result"
import { track } from "../analytics"
import { config } from "../config"
import { db } from "../db"
import { adminSessions, analyticsEvents, photos, uploadSessions } from "../db/schema"
import { errorBody, respond, statusForError } from "../http"
import { signAdminToken } from "../jwt"
import { logger } from "../logger"
import { toPhoto } from "../mappers"
import { ADMIN_COOKIE_NAME, adminAuth } from "../middleware/auth"
import { getAdminSettings, updateSettings } from "../services/settings"
import { getStorageAdapter } from "../storage"
import { clientIp, userAgent } from "../util"

function parsePage(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

const DAY_MS = 24 * 60 * 60 * 1000

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(adminAuth)

  // ── Login ─────────────────────────────────────────────────────────────────────
  .post("/login", async ({ body, headers, set, server, request }) => {
    const parsed = AdminLoginSchema.safeParse(body)
    if (!parsed.success) {
      const err = PixfeteErr.invalidCredentials()
      set.status = statusForError(err)
      return errorBody(err)
    }

    const ok = await bcrypt
      .compare(parsed.data.password, config.adminPasswordHash)
      .catch(() => false)
    if (!ok) {
      const err = PixfeteErr.invalidCredentials()
      set.status = statusForError(err)
      return errorBody(err)
    }

    const ip = clientIp(headers, server?.requestIP(request)?.address)
    const adminSessionId = crypto.randomUUID()
    const token = await signAdminToken(adminSessionId, ADMIN_JWT_EXPIRY_SECONDS)
    const tokenHash = await bcrypt.hash(token, 10)
    const now = Date.now()

    db.insert(adminSessions)
      .values({
        id: adminSessionId,
        tokenHash,
        ipAddress: ip,
        createdAt: now,
        expiresAt: now + ADMIN_JWT_EXPIRY_SECONDS * 1000,
        revoked: false,
      })
      .run()

    track({
      eventType: "admin_login",
      sessionId: adminSessionId,
      ipAddress: ip,
      userAgent: userAgent(headers),
    })

    const secure = config.corsOrigin.startsWith("https://")
    set.headers["Set-Cookie"] = [
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "HttpOnly",
      "SameSite=Strict",
      ...(secure ? ["Secure"] : []),
      "Path=/",
      `Max-Age=${ADMIN_JWT_EXPIRY_SECONDS}`,
    ].join("; ")

    return { success: true }
  })

  // ── Logout ────────────────────────────────────────────────────────────────────
  .post(
    "/logout",
    ({ adminSessionId, authError, set, headers, server, request }) => {
      if (authError) return authError

      db.update(adminSessions)
        .set({ revoked: true })
        .where(eq(adminSessions.id, adminSessionId))
        .run()

      track({
        eventType: "admin_logout",
        sessionId: adminSessionId,
        ipAddress: clientIp(headers, server?.requestIP(request)?.address),
        userAgent: userAgent(headers),
      })

      set.headers["Set-Cookie"] =
        `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
      return { success: true }
    },
    { requireAdmin: true },
  )

  // ── List photos (all statuses, with uploader info) ────────────────────────────
  .get(
    "/photos",
    ({ query, authError, set }) => {
      if (authError) return authError
      const parsed = PhotoFilterSchema.safeParse(query)
      if (!parsed.success) {
        const err = PixfeteErr.invalidMimeType(parsed.error.issues[0]?.message ?? "invalid filter")
        set.status = statusForError(err)
        return errorBody(err)
      }
      const { status, sessionId, page, limit } = parsed.data
      const offset = (page - 1) * limit

      const conditions = []
      if (status !== "all") conditions.push(eq(photos.status, status))
      if (sessionId) conditions.push(eq(photos.uploaderSessionId, sessionId))
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const totalRow = db.select({ count: sql<number>`count(*)` }).from(photos).where(where).all()
      const total = totalRow[0]?.count ?? 0

      const rows = db
        .select({ photo: photos, session: uploadSessions })
        .from(photos)
        .innerJoin(uploadSessions, eq(photos.uploaderSessionId, uploadSessions.id))
        .where(where)
        .orderBy(desc(photos.uploadedAt))
        .limit(limit)
        .offset(offset)
        .all()

      return {
        photos: rows.map((r) => toPhoto(r.photo, r.session)),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      }
    },
    { requireAdmin: true },
  )

  // ── Moderate a single photo ────────────────────────────────────────────────────
  .patch(
    "/photos/:id",
    async ({ params, body, authError, set, headers, server, request }) => {
      if (authError) return authError

      const b = body as { status?: string; rejectionReason?: string }
      if (b.status !== "approved" && b.status !== "rejected") {
        const err = PixfeteErr.invalidMimeType("status must be 'approved' or 'rejected'")
        set.status = statusForError(err)
        return errorBody(err)
      }

      const rows = db
        .select({ photo: photos, session: uploadSessions })
        .from(photos)
        .innerJoin(uploadSessions, eq(photos.uploaderSessionId, uploadSessions.id))
        .where(eq(photos.id, params.id))
        .limit(1)
        .all()
      const found = rows[0]
      if (!found) {
        return respond(R.failure(PixfeteErr.photoNotFound()), set)
      }

      const now = Date.now()
      const update: Partial<typeof photos.$inferInsert> = {}
      if (b.status === "approved") {
        update.status = "approved"
        update.approvedAt = now
        update.rejectedAt = null
        update.rejectionReason = null
        update.publicUrl = getStorageAdapter().getPublicUrl(found.photo.storageKey)
      } else {
        update.status = "rejected"
        update.rejectedAt = now
        update.approvedAt = null
        update.rejectionReason = b.rejectionReason ?? null
        update.publicUrl = null
      }

      db.update(photos).set(update).where(eq(photos.id, params.id)).run()

      track({
        eventType: b.status === "approved" ? "photo_approved" : "photo_rejected",
        sessionId: found.photo.uploaderSessionId,
        ipAddress: clientIp(headers, server?.requestIP(request)?.address),
        userAgent: userAgent(headers),
        metadata: { photoId: params.id },
      })

      const updatedRows = db
        .select({ photo: photos, session: uploadSessions })
        .from(photos)
        .innerJoin(uploadSessions, eq(photos.uploaderSessionId, uploadSessions.id))
        .where(eq(photos.id, params.id))
        .limit(1)
        .all()
      const updated = updatedRows[0] ?? found
      return { photo: toPhoto(updated.photo, updated.session) }
    },
    { requireAdmin: true },
  )

  // ── Bulk moderate ───────────────────────────────────────────────────────────────
  .post(
    "/photos/bulk",
    ({ body, authError, set, headers, server, request }) => {
      if (authError) return authError
      const parsed = BulkPhotoActionSchema.safeParse(body)
      if (!parsed.success) {
        const err = PixfeteErr.invalidMimeType(parsed.error.issues[0]?.message ?? "invalid input")
        set.status = statusForError(err)
        return errorBody(err)
      }
      const { photoIds, action, rejectionReason } = parsed.data
      const now = Date.now()

      let updated = 0
      if (action === "approve") {
        // Public URLs are storageKey-dependent, so resolve per row.
        const rows = db
          .select({ id: photos.id, storageKey: photos.storageKey })
          .from(photos)
          .where(inArray(photos.id, photoIds))
          .all()
        for (const row of rows) {
          db.update(photos)
            .set({
              status: "approved",
              approvedAt: now,
              rejectedAt: null,
              rejectionReason: null,
              publicUrl: getStorageAdapter().getPublicUrl(row.storageKey),
            })
            .where(eq(photos.id, row.id))
            .run()
          updated += 1
        }
      } else {
        // Count the rows that actually exist before updating; the bun-sqlite
        // driver does not surface an affected-row count from `.run()`.
        const existing = db
          .select({ id: photos.id })
          .from(photos)
          .where(inArray(photos.id, photoIds))
          .all()
        updated = existing.length
        db.update(photos)
          .set({
            status: "rejected",
            rejectedAt: now,
            approvedAt: null,
            rejectionReason: rejectionReason ?? null,
            publicUrl: null,
          })
          .where(inArray(photos.id, photoIds))
          .run()
      }

      track({
        eventType: action === "approve" ? "photo_approved" : "photo_rejected",
        ipAddress: clientIp(headers, server?.requestIP(request)?.address),
        userAgent: userAgent(headers),
        metadata: { bulk: true, count: updated },
      })

      return { updated }
    },
    { requireAdmin: true },
  )

  // ── Delete a photo ───────────────────────────────────────────────────────────────
  .delete(
    "/photos/:id",
    async ({ params, authError, set }) => {
      if (authError) return authError

      const rows = db.select().from(photos).where(eq(photos.id, params.id)).limit(1).all()
      const photo = rows[0]
      if (!photo) {
        return respond(R.failure(PixfeteErr.photoNotFound()), set)
      }

      const adapter = getStorageAdapter()
      const deleted = await adapter.deleteFile(photo.storageKey)
      if (R.isFailure(deleted)) {
        logger.warn({ photoId: params.id }, "storage delete failed; removing DB record anyway")
      }
      // Best-effort cleanup of derived transcode artifacts (local only).
      if (photo.transcodedKey) await adapter.deleteFile(photo.transcodedKey)
      if (photo.posterKey) await adapter.deleteFile(photo.posterKey)

      db.delete(photos).where(eq(photos.id, params.id)).run()
      return { success: true }
    },
    { requireAdmin: true },
  )

  // ── Stats / dashboard ─────────────────────────────────────────────────────────────
  .get(
    "/stats",
    ({ authError }) => {
      if (authError) return authError

      const statusCounts = db
        .select({ status: photos.status, c: sql<number>`count(*)` })
        .from(photos)
        .groupBy(photos.status)
        .all()
      const byStatus: Record<string, number> = {}
      for (const row of statusCounts) byStatus[row.status] = row.c

      const totalRow = db.select({ c: sql<number>`count(*)` }).from(photos).all()
      const uploadersRow = db.select({ c: sql<number>`count(*)` }).from(uploadSessions).all()
      const storageRow = db
        .select({ s: sql<number>`coalesce(sum(${photos.originalSize}), 0)` })
        .from(photos)
        .all()

      const now = Date.now()
      const todayStart = now - DAY_MS
      const weekStart = now - 7 * DAY_MS
      const todayRow = db
        .select({ c: sql<number>`count(*)` })
        .from(photos)
        .where(gte(photos.uploadedAt, todayStart))
        .all()
      const weekRow = db
        .select({ c: sql<number>`count(*)` })
        .from(photos)
        .where(gte(photos.uploadedAt, weekStart))
        .all()

      const stats: DashboardStats = {
        totalPhotos: totalRow[0]?.c ?? 0,
        pendingPhotos: byStatus.pending ?? 0,
        approvedPhotos: byStatus.approved ?? 0,
        rejectedPhotos: byStatus.rejected ?? 0,
        totalUploaders: uploadersRow[0]?.c ?? 0,
        totalStorageBytes: storageRow[0]?.s ?? 0,
        uploadsToday: todayRow[0]?.c ?? 0,
        uploadsThisWeek: weekRow[0]?.c ?? 0,
      }

      const recentRows = db
        .select({ photo: photos, session: uploadSessions })
        .from(photos)
        .innerJoin(uploadSessions, eq(photos.uploaderSessionId, uploadSessions.id))
        .orderBy(desc(photos.uploadedAt))
        .limit(10)
        .all()

      const recentEventRows = db
        .select()
        .from(analyticsEvents)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(10)
        .all()

      const recentEvents: AnalyticsEventRow[] = recentEventRows.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        sessionId: e.sessionId ?? null,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        metadata: safeJson(e.metadata),
        createdAt: e.createdAt,
      }))

      return {
        stats,
        recentUploads: recentRows.map((r) => toPhoto(r.photo, r.session)),
        recentEvents,
      }
    },
    { requireAdmin: true },
  )

  // ── Uploaders ─────────────────────────────────────────────────────────────────────
  .get(
    "/uploaders",
    ({ query, authError }) => {
      if (authError) return authError
      const q = query as Record<string, string | undefined>
      const page = parsePage(q.page, 1)
      const limit = Math.min(parsePage(q.limit, 50), 100)
      const offset = (page - 1) * limit

      const totalRow = db.select({ c: sql<number>`count(*)` }).from(uploadSessions).all()
      const total = totalRow[0]?.c ?? 0

      const sessions = db
        .select()
        .from(uploadSessions)
        .orderBy(desc(uploadSessions.createdAt))
        .limit(limit)
        .offset(offset)
        .all()

      const uploaders: UploaderStats[] = sessions.map((session) => {
        const agg = db
          .select({
            photoCount: count(photos.id),
            approvedCount: sql<number>`sum(case when ${photos.status} = 'approved' then 1 else 0 end)`,
            pendingCount: sql<number>`sum(case when ${photos.status} = 'pending' then 1 else 0 end)`,
            totalSize: sql<number>`coalesce(sum(${photos.originalSize}), 0)`,
            firstUpload: min(photos.uploadedAt),
            lastUpload: max(photos.uploadedAt),
          })
          .from(photos)
          .where(eq(photos.uploaderSessionId, session.id))
          .all()
        const row = agg[0]
        return {
          sessionId: session.id,
          uploaderName: session.uploaderName,
          uploaderPhone: session.uploaderPhone ?? null,
          uploaderNote: session.uploaderNote ?? null,
          photoCount: row?.photoCount ?? 0,
          approvedCount: Number(row?.approvedCount ?? 0),
          pendingCount: Number(row?.pendingCount ?? 0),
          totalSizeBytes: Number(row?.totalSize ?? 0),
          firstUploadAt: Number(row?.firstUpload ?? session.createdAt),
          lastUploadAt: Number(row?.lastUpload ?? session.createdAt),
          ipAddress: session.ipAddress,
        }
      })

      return {
        uploaders,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      }
    },
    { requireAdmin: true },
  )

  // ── Analytics ───────────────────────────────────────────────────────────────────────
  .get(
    "/analytics",
    ({ query, authError, set }) => {
      if (authError) return authError
      const parsed = AnalyticsFilterSchema.safeParse(query)
      if (!parsed.success) {
        const err = PixfeteErr.invalidMimeType(parsed.error.issues[0]?.message ?? "invalid filter")
        set.status = statusForError(err)
        return errorBody(err)
      }
      const { from, to, eventType, page, limit } = parsed.data
      const offset = (page - 1) * limit

      const conditions = []
      if (from !== undefined) conditions.push(gte(analyticsEvents.createdAt, from))
      if (to !== undefined) conditions.push(sql`${analyticsEvents.createdAt} <= ${to}`)
      if (eventType) conditions.push(eq(analyticsEvents.eventType, eventType))
      const where = conditions.length > 0 ? and(...conditions) : undefined

      const totalRow = db
        .select({ c: sql<number>`count(*)` })
        .from(analyticsEvents)
        .where(where)
        .all()
      const total = totalRow[0]?.c ?? 0

      const uniqueRow = db
        .select({ c: sql<number>`count(distinct ${analyticsEvents.ipAddress})` })
        .from(analyticsEvents)
        .where(where)
        .all()
      const uniqueIps = uniqueRow[0]?.c ?? 0

      const dayRows = db
        .select({
          day: sql<string>`date(${analyticsEvents.createdAt} / 1000, 'unixepoch')`,
          c: sql<number>`count(*)`,
        })
        .from(analyticsEvents)
        .where(
          where
            ? and(where, eq(analyticsEvents.eventType, "upload_complete"))
            : eq(analyticsEvents.eventType, "upload_complete"),
        )
        .groupBy(sql`date(${analyticsEvents.createdAt} / 1000, 'unixepoch')`)
        .all()
      const uploadsByDay = dayRows.map((r) => ({ date: r.day, count: r.c }))

      const eventRows = db
        .select()
        .from(analyticsEvents)
        .where(where)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(limit)
        .offset(offset)
        .all()

      const events: AnalyticsEventRow[] = eventRows.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        sessionId: e.sessionId ?? null,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
        metadata: safeJson(e.metadata),
        createdAt: e.createdAt,
      }))

      return { totalEvents: total, uniqueIps, uploadsByDay, events, page, limit, total }
    },
    { requireAdmin: true },
  )

  // ── App settings (admin-managed config) ───────────────────────────────────────
  .get(
    "/settings",
    ({ authError }) => {
      if (authError) return authError
      return getAdminSettings()
    },
    { requireAdmin: true },
  )
  .patch(
    "/settings",
    ({ body, authError, set }) => {
      if (authError) return authError
      const parsed = UpdateSettingsSchema.safeParse(body)
      if (!parsed.success) {
        const err = PixfeteErr.invalidSettings(parsed.error.issues[0]?.message ?? "invalid input")
        set.status = statusForError(err)
        return errorBody(err)
      }
      return respond(updateSettings(parsed.data), set)
    },
    { requireAdmin: true },
  )

  // ── Resolve a maps URL to coordinates (server-side: follows short links) ──────
  .post(
    "/resolve-location",
    async ({ body, authError, set }) => {
      if (authError) return authError
      const url = (body as { url?: unknown }).url
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        const err = PixfeteErr.invalidSettings("invalid url")
        set.status = statusForError(err)
        return errorBody(err)
      }

      let coords = coordsFromMapUrl(url)
      if (!coords) {
        try {
          // Server-side fetch follows the short-link redirect (no CORS); the
          // expanded URL or the page body usually contains the coordinates.
          const res = await fetch(url, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; pixfete/1.0)" },
          })
          coords = coordsFromMapUrl(res.url)
          if (!coords) coords = coordsFromText(await res.text())
        } catch {
          // Unreachable / blocked — fall through to null.
        }
      }
      return { lat: coords?.lat ?? null, lng: coords?.lng ?? null }
    },
    { requireAdmin: true },
  )

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// Re-export the status list so the OpenAPI surface stays in sync if extended.
export const ADMIN_PHOTO_STATUSES = PHOTO_STATUSES
