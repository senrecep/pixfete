// `and` is used for the public gallery composite predicate below.
import { PixfeteErr } from "@pixfete/shared"
import { and, desc, eq, sql } from "drizzle-orm"
import { Elysia } from "elysia"
import { track } from "../analytics"
import { db } from "../db"
import { photos, uploadSessions } from "../db/schema"
import { errorBody } from "../http"
import { toPhoto } from "../mappers"
import { getPublicSettings } from "../services/settings"
import { clientIp, userAgent } from "../util"

function parsePage(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function myPhotos(
  token: string,
  headers: Record<string, string | undefined>,
  set: { status?: number | string },
  ipFallback: string | undefined,
) {
  const sessionRows = db
    .select()
    .from(uploadSessions)
    .where(eq(uploadSessions.viewerToken, token))
    .limit(1)
    .all()
  const session = sessionRows[0]
  if (!session) {
    set.status = 404
    return errorBody(PixfeteErr.sessionNotFound())
  }

  const rows = db
    .select()
    .from(photos)
    .where(eq(photos.uploaderSessionId, session.id))
    .orderBy(desc(photos.uploadedAt))
    .all()

  track({
    eventType: "my_photos_view",
    sessionId: session.id,
    ipAddress: clientIp(headers, ipFallback),
    userAgent: userAgent(headers),
  })

  return {
    uploaderName: session.uploaderName,
    photos: rows.map((row) => toPhoto(row, session)),
  }
}

export const photoRoutes = new Elysia()
  // ── Public gallery: approved + complete photos ────────────────────────────────
  .get("/api/photos", ({ query, headers, server, request }) => {
    const q = query as Record<string, string | undefined>
    const page = parsePage(q.page, 1)
    const limit = Math.min(parsePage(q.limit, 50), 100)
    const offset = (page - 1) * limit

    const where = and(eq(photos.status, "approved"), eq(photos.uploadComplete, true))

    const totalRow = db.select({ count: sql<number>`count(*)` }).from(photos).where(where).all()
    const total = totalRow[0]?.count ?? 0

    const rows = db
      .select({ photo: photos, session: uploadSessions })
      .from(photos)
      .innerJoin(uploadSessions, eq(photos.uploaderSessionId, uploadSessions.id))
      .where(where)
      .orderBy(desc(photos.approvedAt), desc(photos.uploadedAt))
      .limit(limit)
      .offset(offset)
      .all()

    track({
      eventType: "gallery_view",
      ipAddress: clientIp(headers, server?.requestIP(request)?.address),
      userAgent: userAgent(headers),
    })

    return {
      photos: rows.map((r) => toPhoto(r.photo, r.session)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  })

  // ── My photos by viewer token (all statuses) ─────────────────────────────────
  // Served under both /mine/:token (web client) and /my/:token (alias).
  .get("/api/photos/mine/:token", ({ params, headers, set, server, request }) =>
    myPhotos(params.token, headers, set, server?.requestIP(request)?.address),
  )
  .get("/api/photos/my/:token", ({ params, headers, set, server, request }) =>
    myPhotos(params.token, headers, set, server?.requestIP(request)?.address),
  )

  // ── Public settings: event + feature flags (no secrets) ───────────────────────
  .get("/api/event", () => getPublicSettings())
