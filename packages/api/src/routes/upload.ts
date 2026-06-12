import { appendFile, stat, writeFile } from "node:fs/promises"
import {
  ALLOWED_MIME_TYPES,
  CompleteUploadSchema,
  CreateUploadSessionSchema,
  MAX_FILE_SIZE_BYTES,
  PixfeteErr,
  PrepareUploadSchema,
} from "@pixfete/shared"
import type { AllowedMimeType } from "@pixfete/shared"
import { and, eq } from "drizzle-orm"
import { Elysia } from "elysia"
import { Result as R } from "tsentials/result"
import { track } from "../analytics"
import { config } from "../config"
import { db } from "../db"
import { photos, uploadSessions } from "../db/schema"
import { errorBody, respond, statusForError } from "../http"
import { logger } from "../logger"
import { resolveAdminSessionId } from "../middleware/auth"
import { detectMimeFromBytes } from "../middleware/magicBytes"
import { createRateLimiter } from "../middleware/rateLimit"
import { getSettings } from "../services/settings"
import { getStorageAdapter } from "../storage"
import { clientIp, generatePhotoId, generateViewerToken, userAgent } from "../util"

const HOUR_MS = 60 * 60 * 1000
// Limits are read live from admin-managed settings (no restart on change).
const uploadLimiter = createRateLimiter(() => getSettings().upload.rateLimitUploadsPerHour, HOUR_MS)
const maxFileBytes = () =>
  Math.min(getSettings().upload.maxFileSizeMb * 1024 * 1024, MAX_FILE_SIZE_BYTES)
const maxFilesPerSession = () => getSettings().upload.maxFilesPerSession

function zodFail(message: string) {
  return PixfeteErr.invalidMimeType(message)
}

/** Narrow the adapter to local so we can call resolveLocalPath. */
function localPath(storageKey: string): string | null {
  const storageAdapter = getStorageAdapter()
  if (storageAdapter.provider !== "local") return null
  const resolve = storageAdapter.resolveLocalPath
  return typeof resolve === "function" ? resolve.call(storageAdapter, storageKey) : null
}

export const uploadRoutes = new Elysia({ prefix: "/api/upload" })
  // ── Create session ──────────────────────────────────────────────────────────
  .post("/session", ({ body, headers, set, server, request }) => {
    const parsed = CreateUploadSessionSchema.safeParse(body)
    if (!parsed.success) {
      const err = zodFail(parsed.error.issues[0]?.message ?? "invalid input")
      set.status = statusForError(err)
      return errorBody(err)
    }

    const ip = clientIp(headers, server?.requestIP(request)?.address)
    const ua = userAgent(headers)
    const sessionId = crypto.randomUUID()
    const viewerToken = generateViewerToken()

    db.insert(uploadSessions)
      .values({
        id: sessionId,
        uploaderName: parsed.data.uploaderName,
        uploaderPhone: parsed.data.uploaderPhone ?? null,
        uploaderNote: parsed.data.uploaderNote ?? null,
        viewerToken,
        ipAddress: ip,
        userAgent: ua,
        createdAt: Date.now(),
      })
      .run()

    track({ eventType: "upload_session_start", sessionId, ipAddress: ip, userAgent: ua })

    return {
      sessionId,
      viewerToken,
      viewerUrl: `${config.corsOrigin}/my/${viewerToken}`,
    }
  })

  // ── Resume session by viewer token ───────────────────────────────────────────
  // Lets a returning device reuse its existing session (stored client-side) so
  // new uploads join the same gallery, without keying access to name/phone.
  .post("/session/resume", ({ body, set }) => {
    const token = (body as { viewerToken?: unknown }).viewerToken
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(token)) {
      set.status = 404
      return errorBody(PixfeteErr.sessionNotFound())
    }

    const rows = db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.viewerToken, token))
      .limit(1)
      .all()
    const session = rows[0]
    if (!session) {
      set.status = 404
      return errorBody(PixfeteErr.sessionNotFound())
    }

    return {
      sessionId: session.id,
      viewerToken: session.viewerToken,
      viewerUrl: `${config.corsOrigin}/my/${session.viewerToken}`,
      uploaderName: session.uploaderName,
    }
  })

  // ── Prepare uploads ───────────────────────────────────────────────────────────
  .post("/prepare", async ({ body, headers, set, server, request }) => {
    const parsed = PrepareUploadSchema.safeParse(body)
    if (!parsed.success) {
      const err = zodFail(parsed.error.issues[0]?.message ?? "invalid input")
      set.status = statusForError(err)
      return errorBody(err)
    }
    const { sessionId, files } = parsed.data

    const ip = clientIp(headers, server?.requestIP(request)?.address)
    const ua = userAgent(headers)

    const rl = uploadLimiter.check(ip)
    if (!rl.allowed) {
      const err = PixfeteErr.rateLimited()
      set.status = statusForError(err)
      set.headers["Retry-After"] = String(rl.retryAfterSeconds)
      return errorBody(err)
    }

    const sessionRows = db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, sessionId))
      .limit(1)
      .all()
    const session = sessionRows[0]
    if (!session) return respond(R.failure(PixfeteErr.sessionNotFound()), set)

    const storageAdapter = getStorageAdapter()
    const existing = db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.uploaderSessionId, sessionId))
      .all()
    const fileLimit = maxFilesPerSession()
    if (existing.length + files.length > fileLimit) {
      return respond(R.failure(PixfeteErr.tooManyFiles(fileLimit)), set)
    }

    const uploads: Array<{
      photoId: string
      fileName: string
      storageType: string
      uploadUrl: string | null
      uploadMethod: string | null
      headers: Record<string, string> | null
      storageKey: string
    }> = []

    const fileSizeLimit = maxFileBytes()
    // Validate everything up front (cheap) so we fail fast before any Drive calls.
    for (const file of files) {
      if (file.fileSize > fileSizeLimit) {
        return respond(R.failure(PixfeteErr.fileTooLarge(getSettings().upload.maxFileSizeMb)), set)
      }
      if (!ALLOWED_MIME_TYPES.includes(file.mimeType as AllowedMimeType)) {
        return respond(R.failure(PixfeteErr.invalidMimeType(file.mimeType)), set)
      }
    }

    // Presign all files concurrently. Each file's Drive resumable-session init is
    // an independent network round trip, so running them in parallel collapses
    // N×latency (~15s for 19 files) into roughly a single round trip.
    const prepared = await Promise.all(
      files.map(async (file) => {
        const photoId = generatePhotoId()
        const result = await storageAdapter.prepareUpload({
          photoId,
          fileName: file.fileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          uploaderName: session.uploaderName,
        })
        return { file, photoId, result }
      }),
    )

    const failed = prepared.find((p) => !p.result.ok)
    if (failed) return respond(failed.result, set)

    for (const p of prepared) {
      if (!p.result.ok) continue
      db.insert(photos)
        .values({
          id: p.photoId,
          uploaderSessionId: sessionId,
          fileName: p.file.fileName,
          originalSize: p.file.fileSize,
          storageType: storageAdapter.provider,
          storageKey: p.result.value.storageKey,
          status: "pending",
          mimeType: p.file.mimeType,
          width: p.file.width ?? null,
          height: p.file.height ?? null,
          uploadedAt: Date.now(),
          uploadComplete: false,
        })
        .run()

      uploads.push({
        photoId: p.photoId,
        fileName: p.file.fileName,
        storageType: storageAdapter.provider,
        uploadUrl: p.result.value.uploadUrl,
        uploadMethod: p.result.value.uploadMethod,
        headers: p.result.value.uploadHeaders,
        storageKey: p.result.value.storageKey,
      })
    }

    track({
      eventType: "upload_session_start",
      sessionId,
      ipAddress: ip,
      userAgent: ua,
      metadata: { fileCount: files.length },
    })

    return { uploads }
  })

  // ── Complete upload ─────────────────────────────────────────────────────────
  .post("/complete", async ({ body, headers, set, server, request }) => {
    const parsed = CompleteUploadSchema.safeParse(body)
    if (!parsed.success) {
      const err = zodFail(parsed.error.issues[0]?.message ?? "invalid input")
      set.status = statusForError(err)
      return errorBody(err)
    }

    const { photoId, driveFileId } = parsed.data
    const storageAdapter = getStorageAdapter()

    const rows = db.select().from(photos).where(eq(photos.id, photoId)).limit(1).all()
    const photo = rows[0]
    if (!photo) return respond(R.failure(PixfeteErr.photoNotFound()), set)

    // GDrive: client sends back the real file ID from the Drive API response.
    if (storageAdapter.provider === "gdrive" && driveFileId) {
      db.update(photos).set({ storageKey: driveFileId }).where(eq(photos.id, photoId)).run()
    }

    const currentKey =
      storageAdapter.provider === "gdrive" && driveFileId ? driveFileId : photo.storageKey

    // Verify the file landed in storage (R2 + GDrive only; local marks complete per chunk)
    if (storageAdapter.provider !== "local") {
      const verified = await storageAdapter.verifyUpload(currentKey)
      if (!verified.ok) {
        return respond(
          R.failure(PixfeteErr.storageFailed("file not found in storage after upload")),
          set,
        )
      }
    }

    db.update(photos).set({ uploadComplete: true }).where(eq(photos.id, photoId)).run()

    const ip = clientIp(headers, server?.requestIP(request)?.address)
    track({
      eventType: "upload_complete",
      sessionId: photo.uploaderSessionId,
      ipAddress: ip,
      userAgent: userAgent(headers),
      metadata: { photoId: photo.id, storage: storageAdapter.provider },
    })

    logger.info({ photoId, storage: storageAdapter.provider }, "upload complete")

    return {
      success: true,
      pendingMessage: "Fotoğrafınız onay bekliyor. Onaylandıktan sonra galeride görünecek.",
    }
  })

  // ── Local chunked upload ──────────────────────────────────────────────────────
  .post("/local/:photoId", async ({ params, headers, body, request, set, server }) => {
    if (getStorageAdapter().provider !== "local") {
      return respond(R.failure(PixfeteErr.storageFailed("local upload not enabled")), set)
    }

    const ip = clientIp(headers, server?.requestIP(request)?.address)
    const rl = uploadLimiter.check(ip)
    if (!rl.allowed) {
      const err = PixfeteErr.rateLimited()
      set.status = statusForError(err)
      set.headers["Retry-After"] = String(rl.retryAfterSeconds)
      return errorBody(err)
    }

    const rows = db.select().from(photos).where(eq(photos.id, params.photoId)).limit(1).all()
    const photo = rows[0]
    if (!photo) return respond(R.failure(PixfeteErr.photoNotFound()), set)
    if (photo.uploadComplete) return respond(R.failure(PixfeteErr.alreadyProcessed()), set)

    const chunkIndex = Number(headers["x-chunk-index"] ?? "0")
    const totalChunks = Number(headers["x-total-chunks"] ?? "1")

    const raw = body as ArrayBuffer | Uint8Array | Buffer | null
    if (!raw) return respond(R.failure(PixfeteErr.storageFailed("empty chunk")), set)
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer)

    const target = localPath(photo.storageKey)
    if (!target) {
      return respond(R.failure(PixfeteErr.storageFailed("cannot resolve local path")), set)
    }

    if (chunkIndex === 0) {
      const detected = detectMimeFromBytes(chunk)
      if (!detected) {
        return respond(R.failure(PixfeteErr.invalidMimeType("unrecognized file signature")), set)
      }
      await writeFile(target, chunk)
    } else {
      const current = await stat(target).catch(() => null)
      if (current && current.size + chunk.length > maxFileBytes()) {
        return respond(R.failure(PixfeteErr.fileTooLarge(getSettings().upload.maxFileSizeMb)), set)
      }
      await appendFile(target, chunk)
    }

    const isLast = chunkIndex >= totalChunks - 1
    if (isLast) {
      db.update(photos).set({ uploadComplete: true }).where(eq(photos.id, photo.id)).run()
      track({
        eventType: "upload_complete",
        sessionId: photo.uploaderSessionId,
        ipAddress: ip,
        userAgent: userAgent(headers),
        metadata: { photoId: photo.id, storage: "local" },
      })
    }

    return { success: true, received: chunkIndex + 1, total: totalChunks, complete: isLast }
  })

// ── Serve local files (GET /api/uploads/*) ────────────────────────────────────
export const uploadsServeRoutes = new Elysia().get(
  "/api/uploads/*",
  async ({ params, query, set, headers }) => {
    const adapter = getStorageAdapter()
    // Served for local (filesystem) and any provider that can stream bytes
    // through the API (e.g. private Google Drive via fetchObject).
    if (adapter.provider !== "local" && !adapter.fetchObject) {
      set.status = 404
      return errorBody(PixfeteErr.photoNotFound())
    }

    // The wildcard arrives percent-encoded (e.g. spaces as %20); decode it so it
    // matches the storageKey stored in the DB. Path separators are not encoded.
    // Malformed encoding falls back to the raw value (which will simply 404).
    const rawKey = (params as Record<string, string>)["*"] ?? ""
    const decoded = R.try(() => decodeURIComponent(rawKey))
    const storageKey = R.isSuccess(decoded) ? decoded.value : rawKey
    if (!storageKey) {
      set.status = 404
      return errorBody(PixfeteErr.photoNotFound())
    }

    // Look up directly by storageKey — avoids fragile path-splitting hacks
    const rows = db.select().from(photos).where(eq(photos.storageKey, storageKey)).limit(1).all()
    const photo = rows[0]
    if (!photo) {
      set.status = 404
      return errorBody(PixfeteErr.photoNotFound())
    }

    // Auth: approved = public; pending/rejected = owner viewer token OR admin.
    const viewerToken = (query as Record<string, string | undefined>).token
    let authorized = photo.status === "approved"
    if (!authorized && viewerToken) {
      const sessionRows = db
        .select({ id: uploadSessions.id })
        .from(uploadSessions)
        .where(
          and(
            eq(uploadSessions.id, photo.uploaderSessionId),
            eq(uploadSessions.viewerToken, viewerToken),
          ),
        )
        .limit(1)
        .all()
      authorized = sessionRows.length > 0
    }
    // Admins can preview any photo (e.g. the moderation queue) via their session.
    if (!authorized) {
      authorized = (await resolveAdminSessionId(headers.authorization, headers.cookie)) !== null
    }

    if (!authorized) {
      set.status = 403
      return errorBody(PixfeteErr.sessionInvalid())
    }

    // Non-local providers (GDrive): stream the bytes via the adapter. Return a
    // bare Response so Elysia doesn't append a default `text/plain` Content-Type
    // alongside ours (which can stop browsers from rendering the image).
    if (adapter.provider !== "local" && adapter.fetchObject) {
      const fetched = await adapter.fetchObject(storageKey)
      if (!fetched.ok) {
        set.status = 404
        return errorBody(PixfeteErr.photoNotFound())
      }
      return new Response(fetched.value.body, {
        headers: {
          "Content-Type": photo.mimeType,
          "Cache-Control": "private, max-age=3600",
          "X-Robots-Tag": "noindex, noimageindex",
        },
      })
    }

    set.headers["Cache-Control"] = "private, max-age=3600"
    set.headers["X-Robots-Tag"] = "noindex, noimageindex"

    const absolute = localPath(storageKey)
    if (!absolute) {
      set.status = 400
      return errorBody(PixfeteErr.photoNotFound())
    }

    const info = await stat(absolute).catch(() => null)
    if (!info?.isFile()) {
      set.status = 404
      return errorBody(PixfeteErr.photoNotFound())
    }

    set.headers["Content-Type"] = photo.mimeType
    return Bun.file(absolute)
  },
)
