import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, normalize, resolve } from "node:path"
import type { AppSettingsInput, StorageProvider } from "@pixfete/shared"
import { PixfeteErr } from "@pixfete/shared"
import { Result as R } from "tsentials/result"
import type { Result } from "tsentials/result"
import { config } from "./config"
import { getSettings, settingsVersion } from "./services/settings"

type StorageConfig = AppSettingsInput["storage"]

export interface PrepareUploadParams {
  photoId: string
  fileName: string
  mimeType: string
  fileSize: number
  uploaderName: string
}

export interface PreparedUpload {
  storageKey: string
  uploadUrl: string | null
  uploadMethod: "PUT" | "POST"
  uploadHeaders: Record<string, string> | null
  fields: Record<string, string> | null
}

export interface StorageAdapter {
  readonly provider: StorageProvider
  prepareUpload(params: PrepareUploadParams): Promise<Result<PreparedUpload>>
  verifyUpload(storageKey: string): Promise<Result<void>>
  getPublicUrl(storageKey: string): string
  deleteFile(storageKey: string): Promise<Result<void>>
  resolveLocalPath?(storageKey: string): string
  /**
   * Streams object bytes through the API. Implemented by providers without
   * publicly reachable URLs (e.g. private Google Drive), so the browser can
   * load images via the authenticated `/api/uploads/*` proxy. Returns a `fetch`
   * Response whose body is piped to the client.
   */
  fetchObject?(storageKey: string): Promise<Result<Response>>
  /**
   * Downloads an object from storage to a local file path. Used by the
   * transcode pipeline for cloud providers (R2, GDrive) to fetch video files
   * before running FFmpeg locally, then re-uploading the result.
   */
  downloadToPath?(storageKey: string, destPath: string): Promise<boolean>
  /**
   * Uploads a local file to storage under destKey and returns the final
   * storage key (may differ from destKey for GDrive which uses file IDs).
   */
  uploadFromPath?(
    destKey: string,
    srcPath: string,
    mimeType: string,
    originalKey: string,
  ): Promise<string | null>
  /**
   * Optional fire-and-forget pre-warm. Lets a provider pay one-time cold-start
   * costs (SDK import, auth, base folder lookup) at boot instead of on the first
   * user upload. Must never throw.
   */
  warmUp?(): void
}

// ── Shared path utilities ─────────────────────────────────────────────────────

function buildKey(...parts: string[]): string {
  return parts.filter(Boolean).join("/")
}

const TR_MAP: Record<string, string> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ç: "c",
  Ç: "c",
  ö: "o",
  Ö: "o",
  ü: "u",
  Ü: "u",
}

function nameToSlug(name: string): string {
  return (
    name
      .split("")
      .map((c) => TR_MAP[c] ?? c)
      .join("")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "uploader"
  )
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
}

/**
 * Derives a short, url-safe file extension for the stored object. The original
 * file name is kept in the DB for display, so the stored key only needs a clean
 * extension — preferring the MIME type, falling back to the name's suffix.
 */
function extFor(fileName: string, mimeType: string): string {
  const byMime = MIME_EXT[mimeType.toLowerCase()]
  if (byMime) return byMime
  const suffix = fileName.includes(".") ? (fileName.split(".").pop() ?? "") : ""
  const clean = suffix.toLowerCase().replace(/[^a-z0-9]/g, "")
  return clean.length >= 1 && clean.length <= 5 ? clean : "bin"
}

function safeResolve(baseDir: string, key: string): string | null {
  const base = resolve(baseDir)
  const target = resolve(base, normalize(key))
  if (target !== base && !target.startsWith(`${base}/`)) return null
  return target
}

// ── Local filesystem adapter ──────────────────────────────────────────────────

class LocalStorageAdapter implements StorageAdapter {
  readonly provider = "local" as const
  private readonly baseDir: string
  private readonly basePath: string

  constructor(cfg: StorageConfig) {
    this.baseDir = resolve(cfg.uploadsDir || "./uploads")
    this.basePath = cfg.basePath
  }

  async prepareUpload(params: PrepareUploadParams): Promise<Result<PreparedUpload>> {
    const slug = nameToSlug(params.uploaderName)
    const ext = extFor(params.fileName, params.mimeType)
    // Layout: {baseDir}/[basePath/]{slug}/{photoId}.{ext} — url-safe, no spaces.
    const storageKey = buildKey(this.basePath, slug, `${params.photoId}.${ext}`)
    const target = safeResolve(this.baseDir, storageKey)
    if (!target) return R.failure(PixfeteErr.storageFailed("invalid storage key"))

    await mkdir(dirname(target), { recursive: true })
    return R.success({
      storageKey,
      uploadUrl: null,
      uploadMethod: "POST",
      uploadHeaders: null,
      fields: null,
    })
  }

  async verifyUpload(storageKey: string): Promise<Result<void>> {
    const target = safeResolve(this.baseDir, storageKey)
    if (!target) return R.failure(PixfeteErr.storageFailed("invalid storage key"))
    const info = await stat(target).catch(() => null)
    if (!info?.isFile()) return R.failure(PixfeteErr.uploadNotComplete())
    return R.ok()
  }

  getPublicUrl(storageKey: string): string {
    return `/api/uploads/${storageKey}`
  }

  async deleteFile(storageKey: string): Promise<Result<void>> {
    const target = safeResolve(this.baseDir, storageKey)
    if (!target) return R.failure(PixfeteErr.storageFailed("invalid storage key"))
    // Files share the per-uploader (slug) folder, so only remove the file itself.
    await rm(target, { force: true }).catch(() => undefined)
    return R.ok()
  }

  resolveLocalPath(storageKey: string): string {
    return safeResolve(this.baseDir, storageKey) ?? resolve(this.baseDir, "__invalid__")
  }
}

// ── Cloudflare R2 adapter ─────────────────────────────────────────────────────

async function dynamicImport(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ specifier)
}

class R2StorageAdapter implements StorageAdapter {
  readonly provider = "r2" as const
  private readonly basePath: string
  private readonly endpoint: string
  private readonly accessKeyId: string
  private readonly secretAccessKey: string
  private readonly bucket: string
  private readonly publicBase: string

  constructor(cfg: StorageConfig) {
    this.basePath = cfg.basePath
    this.endpoint = cfg.r2.endpoint
    this.accessKeyId = cfg.r2.accessKey
    this.secretAccessKey = cfg.r2.secretKey
    this.bucket = cfg.r2.bucket
    this.publicBase = cfg.r2.publicUrl.replace(/\/$/, "")
  }

  private async client(): Promise<{
    s3: unknown
    sdk: Record<string, unknown>
    presigner: Record<string, unknown>
  }> {
    const sdk = (await dynamicImport("@aws-sdk/client-s3")) as Record<string, unknown>
    const presigner = (await dynamicImport("@aws-sdk/s3-request-presigner")) as Record<
      string,
      unknown
    >
    const S3Client = sdk.S3Client as new (opts: unknown) => unknown
    const s3 = new S3Client({
      region: "auto",
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    })
    return { s3, sdk, presigner }
  }

  async prepareUpload(params: PrepareUploadParams): Promise<Result<PreparedUpload>> {
    const slug = nameToSlug(params.uploaderName)
    const ext = extFor(params.fileName, params.mimeType)
    // Layout: [basePath/]{slug}/{photoId}.{ext} — url-safe, no spaces.
    const storageKey = buildKey(this.basePath, slug, `${params.photoId}.${ext}`)
    try {
      const { s3, sdk, presigner } = await this.client()
      const PutObjectCommand = sdk.PutObjectCommand as new (opts: unknown) => unknown
      const getSignedUrl = presigner.getSignedUrl as (
        client: unknown,
        command: unknown,
        opts: unknown,
      ) => Promise<string>
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: params.mimeType,
        ContentLength: params.fileSize,
      })
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 })
      return R.success({
        storageKey,
        uploadUrl,
        uploadMethod: "PUT",
        uploadHeaders: {
          "Content-Type": params.mimeType,
          "Content-Length": String(params.fileSize),
        },
        fields: null,
      })
    } catch (e) {
      return R.failure(PixfeteErr.presignFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  async verifyUpload(storageKey: string): Promise<Result<void>> {
    try {
      const { s3, sdk } = await this.client()
      const HeadObjectCommand = sdk.HeadObjectCommand as new (opts: unknown) => unknown
      const send = (s3 as { send: (cmd: unknown) => Promise<unknown> }).send.bind(s3)
      await send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }))
      return R.ok()
    } catch {
      return R.failure(PixfeteErr.uploadNotComplete())
    }
  }

  getPublicUrl(storageKey: string): string {
    return `${this.publicBase}/${storageKey}`
  }

  async deleteFile(storageKey: string): Promise<Result<void>> {
    try {
      const { s3, sdk } = await this.client()
      const DeleteObjectCommand = sdk.DeleteObjectCommand as new (opts: unknown) => unknown
      const send = (s3 as { send: (cmd: unknown) => Promise<unknown> }).send.bind(s3)
      await send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }))
      return R.ok()
    } catch (e) {
      return R.failure(PixfeteErr.storageFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  async downloadToPath(storageKey: string, destPath: string): Promise<boolean> {
    try {
      const { s3, sdk } = await this.client()
      const GetObjectCommand = sdk.GetObjectCommand as new (opts: unknown) => unknown
      const send = (s3 as { send: (cmd: unknown) => Promise<unknown> }).send.bind(s3)
      const obj = (await send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }))) as {
        Body?: { transformToByteArray(): Promise<Uint8Array> }
      }
      if (!obj?.Body) return false
      const bytes = await obj.Body.transformToByteArray().catch(() => null)
      if (!bytes) return false
      await writeFile(destPath, bytes)
      return true
    } catch {
      return false
    }
  }

  async uploadFromPath(
    destKey: string,
    srcPath: string,
    mimeType: string,
    _originalKey: string,
  ): Promise<string | null> {
    try {
      const bytes = await readFile(srcPath).catch(() => null)
      if (!bytes) return null
      const { s3, sdk } = await this.client()
      const PutObjectCommand = sdk.PutObjectCommand as new (opts: unknown) => unknown
      const send = (s3 as { send: (cmd: unknown) => Promise<unknown> }).send.bind(s3)
      await send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: destKey,
          Body: bytes,
          ContentType: mimeType,
        }),
      )
      return destKey
    } catch {
      return null
    }
  }
}

// ── Google Drive adapter ──────────────────────────────────────────────────────

class GDriveStorageAdapter implements StorageAdapter {
  readonly provider = "gdrive" as const
  private readonly rootFolderId: string
  private readonly serviceAccountJson: string
  private readonly basePath: string
  /**
   * In-memory cache: folder cacheKey → in-flight/resolved Drive folder ID.
   * Storing the *promise* (not the resolved id) dedupes concurrent lookups, so a
   * parallel multi-file prepare creates each folder exactly once instead of
   * racing to create N duplicates.
   */
  private readonly folderCache = new Map<string, Promise<string>>()
  // Cached across the adapter's lifetime (rebuilt only when settings change).
  // Without these, a multi-file prepare re-imported googleapis and ran a fresh
  // OAuth token exchange *per file* — the dominant latency before uploads start.
  private drivePromise: Promise<unknown> | null = null
  private authClientPromise: Promise<{
    getAccessToken(): Promise<{ token: string | null }>
  }> | null = null

  constructor(cfg: StorageConfig) {
    this.rootFolderId = cfg.gdrive.folderId
    this.serviceAccountJson = cfg.gdrive.serviceAccountJson
    this.basePath = cfg.basePath
  }

  warmUp(): void {
    // Best-effort: resolve auth + drive client + the base project folder up front
    // so the first upload skips cold start. Errors are swallowed by design.
    void (async () => {
      const drive = await this.getDrive()
      await this.getAccessToken()
      if (this.basePath) await this.getOrCreateFolder(drive, this.basePath, this.rootFolderId)
    })().catch(() => undefined)
  }

  private async getDrive(): Promise<unknown> {
    if (!this.drivePromise) {
      this.drivePromise = (async () => {
        const { google } = (await dynamicImport("googleapis")) as {
          google: Record<string, unknown>
        }
        const credentials = JSON.parse(this.serviceAccountJson || "{}") as Record<string, unknown>
        const GoogleAuth = (google.auth as Record<string, unknown>).GoogleAuth as new (
          opts: unknown,
        ) => { getClient(): Promise<{ getAccessToken(): Promise<{ token: string | null }> }> }
        const auth = new GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/drive"],
        })
        const driveFn = google.drive as (opts: unknown) => unknown
        return driveFn({ version: "v3", auth })
      })()
    }
    return this.drivePromise
  }

  private async getAccessToken(): Promise<string> {
    if (!this.authClientPromise) {
      this.authClientPromise = (async () => {
        const { google } = (await dynamicImport("googleapis")) as {
          google: Record<string, unknown>
        }
        const credentials = JSON.parse(this.serviceAccountJson || "{}") as Record<string, unknown>
        const GoogleAuth = (google.auth as Record<string, unknown>).GoogleAuth as new (
          opts: unknown,
        ) => { getClient(): Promise<{ getAccessToken(): Promise<{ token: string | null }> }> }
        const auth = new GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/drive"],
        })
        return auth.getClient()
      })()
    }
    // The googleapis client caches & refreshes the token internally, so repeated
    // calls reuse it without a new network round trip.
    const client = await this.authClientPromise
    return (await client.getAccessToken()).token ?? ""
  }

  private getOrCreateFolder(drive: unknown, name: string, parentId: string): Promise<string> {
    const cacheKey = `${parentId}/${name}`
    const cached = this.folderCache.get(cacheKey)
    if (cached) return cached

    const task = (async () => {
      const d = drive as {
        files: {
          list(opts: unknown): Promise<{ data: { files?: Array<{ id?: string }> } }>
          create(opts: unknown): Promise<{ data: { id?: string } }>
        }
      }

      const search = await d.files.list({
        q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
        fields: "files(id)",
        spaces: "drive",
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      const existing = search.data.files?.[0]?.id
      if (existing) return existing

      const created = await d.files.create({
        requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
        fields: "id",
        supportsAllDrives: true,
      })
      const newId = created.data.id
      if (!newId) throw new Error(`Failed to create GDrive folder: ${name}`)
      return newId
    })()

    this.folderCache.set(cacheKey, task)
    // Don't cache a rejection permanently — let the next attempt retry cleanly.
    task.catch(() => this.folderCache.delete(cacheKey))
    return task
  }

  private async getUploadParentId(drive: unknown, slug: string): Promise<string> {
    const projectFolderId = this.basePath
      ? await this.getOrCreateFolder(drive, this.basePath, this.rootFolderId)
      : this.rootFolderId
    return this.getOrCreateFolder(drive, slug, projectFolderId)
  }

  async prepareUpload(params: PrepareUploadParams): Promise<Result<PreparedUpload>> {
    try {
      const slug = nameToSlug(params.uploaderName)
      const drive = await this.getDrive()
      const subfolderId = await this.getUploadParentId(drive, slug)
      const accessToken = await this.getAccessToken()

      // Store under the nanoid photoId + extension (consistent with local/R2),
      // not the user-supplied original filename.
      const ext = extFor(params.fileName, params.mimeType)
      const fileName = `${params.photoId}.${ext}`
      const metadataBody = JSON.stringify({ name: fileName, parents: [subfolderId] })
      const initRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "Content-Length": String(new TextEncoder().encode(metadataBody).length),
            "X-Upload-Content-Type": params.mimeType,
            "X-Upload-Content-Length": String(params.fileSize),
            // Echo the browser origin so Google attaches CORS headers to the
            // resumable upload URL — the client PUTs bytes directly from the browser.
            Origin: config.corsOrigin,
          },
          body: metadataBody,
        },
      )

      const uploadUrl = initRes.headers.get("location")

      // storageKey is a placeholder; client sends back real Drive file ID via /complete
      return R.success({
        storageKey: `pending:${params.photoId}`,
        uploadUrl,
        uploadMethod: "POST",
        uploadHeaders: {
          "Content-Type": params.mimeType,
          "Content-Length": String(params.fileSize),
        },
        fields: null,
      })
    } catch (e) {
      return R.failure(PixfeteErr.presignFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  async verifyUpload(storageKey: string): Promise<Result<void>> {
    if (storageKey.startsWith("pending:")) return R.failure(PixfeteErr.uploadNotComplete())
    try {
      const drive = await this.getDrive()
      const d = drive as { files: { get(opts: unknown): Promise<unknown> } }
      await d.files.get({ fileId: storageKey, fields: "id", supportsAllDrives: true })
      return R.ok()
    } catch {
      return R.failure(PixfeteErr.uploadNotComplete())
    }
  }

  getPublicUrl(storageKey: string): string {
    // Drive files live in a private Shared Drive — they are not publicly
    // reachable, so route image loads through the authenticated API proxy
    // (same scheme as local storage) which streams bytes via fetchObject().
    return `/api/uploads/${storageKey}`
  }

  /** Downloads the raw file bytes from Drive using the service account. */
  async fetchObject(storageKey: string): Promise<Result<Response>> {
    if (storageKey.startsWith("pending:")) return R.failure(PixfeteErr.photoNotFound())
    try {
      const accessToken = await this.getAccessToken()
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${storageKey}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!res.ok)
        return R.failure(PixfeteErr.storageFailed(`Drive download failed: ${res.status}`))
      return R.success(res)
    } catch (e) {
      return R.failure(PixfeteErr.storageFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  async deleteFile(storageKey: string): Promise<Result<void>> {
    if (storageKey.startsWith("pending:")) return R.ok()
    try {
      const drive = await this.getDrive()
      const d = drive as { files: { delete(opts: unknown): Promise<unknown> } }
      await d.files.delete({ fileId: storageKey, supportsAllDrives: true })
      return R.ok()
    } catch (e) {
      return R.failure(PixfeteErr.storageFailed(e instanceof Error ? e.message : String(e)))
    }
  }

  async downloadToPath(storageKey: string, destPath: string): Promise<boolean> {
    const result = await this.fetchObject(storageKey)
    if (!result.ok) return false
    const bytes = await result.value.arrayBuffer().catch(() => null)
    if (!bytes) return false
    return writeFile(destPath, Buffer.from(bytes))
      .then(() => true)
      .catch(() => false)
  }

  async uploadFromPath(
    destKey: string,
    srcPath: string,
    mimeType: string,
    originalKey: string,
  ): Promise<string | null> {
    if (originalKey.startsWith("pending:")) return null
    try {
      const drive = await this.getDrive()
      const d = drive as {
        files: {
          get(opts: unknown): Promise<{ data: { parents?: string[] } }>
          create(opts: unknown): Promise<{ data: { id?: string } }>
        }
      }
      const original = await d.files
        .get({ fileId: originalKey, fields: "parents", supportsAllDrives: true })
        .catch(() => null)
      const parentId = original?.data.parents?.[0]
      if (!parentId) return null
      const bytes = await readFile(srcPath).catch(() => null)
      if (!bytes) return null
      const fileName = destKey.split("/").pop() ?? destKey
      const created = await d.files
        .create({
          requestBody: { name: fileName, parents: [parentId] },
          media: { mimeType, body: bytes },
          supportsAllDrives: true,
          fields: "id",
        })
        .catch(() => null)
      return created?.data.id ?? null
    } catch {
      return null
    }
  }
}

// ── Factory (settings-driven, rebuilt on change) ──────────────────────────────

function buildAdapter(cfg: StorageConfig): StorageAdapter {
  switch (cfg.provider) {
    case "r2":
      return new R2StorageAdapter(cfg)
    case "gdrive":
      return new GDriveStorageAdapter(cfg)
    default:
      return new LocalStorageAdapter(cfg)
  }
}

let adapterCache: { version: number; adapter: StorageAdapter } | null = null

/**
 * Returns the storage adapter for the current settings, rebuilding it when the
 * admin changes the storage configuration (detected via the settings version).
 */
export function getStorageAdapter(): StorageAdapter {
  const v = settingsVersion()
  if (adapterCache && adapterCache.version === v) return adapterCache.adapter
  const adapter = buildAdapter(getSettings().storage)
  adapterCache = { version: v, adapter }
  // Pre-warm the freshly built adapter (e.g. at boot, or after a settings change)
  // so the first upload doesn't pay provider cold-start latency.
  adapter.warmUp?.()
  return adapter
}
