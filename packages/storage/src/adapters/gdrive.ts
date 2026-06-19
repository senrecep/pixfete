import { readFile, writeFile } from "node:fs/promises"
import { PRESIGNED_URL_EXPIRY_SECONDS } from "@pixfete/shared"
import type { StorageProvider } from "@pixfete/shared"
import { type Auth, google } from "googleapis"
import { nameToSlug } from "../pathUtils"
import type { FetchObjectResult, PrepareUploadOpts, PreparedUpload, StorageAdapter } from "../types"

export interface GoogleDriveConfig {
  serviceAccountJson: string
  folderId: string
}

export class GoogleDriveAdapter implements StorageAdapter {
  readonly provider: StorageProvider = "gdrive"
  private readonly rootFolderId: string
  private readonly serviceAccountJson: string
  /** In-memory cache: slug → subfolder Drive ID (avoids repeated API calls per session) */
  private readonly subfolderCache = new Map<string, string>()

  constructor(config: GoogleDriveConfig) {
    this.rootFolderId = config.folderId
    this.serviceAccountJson = config.serviceAccountJson
  }

  private getDriveClient() {
    const credentials = JSON.parse(this.serviceAccountJson) as Record<string, unknown>
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    })
    return google.drive({ version: "v3", auth })
  }

  private async getAccessToken(): Promise<string> {
    const drive = this.getDriveClient()
    const authClient = await (drive.context._options.auth as Auth.GoogleAuth).getClient()
    const tokenResponse = await authClient.getAccessToken()
    return tokenResponse.token ?? ""
  }

  /**
   * Returns the Drive folder ID for the given uploader slug,
   * creating the subfolder if it doesn't already exist.
   */
  private async getOrCreateSubfolder(slug: string): Promise<string> {
    const cached = this.subfolderCache.get(slug)
    if (cached) return cached

    const drive = this.getDriveClient()

    // Search for existing folder with this name inside the root folder
    const search = await drive.files.list({
      q: `name='${slug}' and mimeType='application/vnd.google-apps.folder' and '${this.rootFolderId}' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const existing = search.data.files?.[0]
    if (existing?.id) {
      this.subfolderCache.set(slug, existing.id)
      return existing.id
    }

    // Create new subfolder
    const created = await drive.files.create({
      requestBody: {
        name: slug,
        mimeType: "application/vnd.google-apps.folder",
        parents: [this.rootFolderId],
      },
      fields: "id",
      supportsAllDrives: true,
    })

    const newId = created.data.id
    if (!newId) throw new Error(`Failed to create GDrive subfolder: ${slug}`)

    this.subfolderCache.set(slug, newId)
    return newId
  }

  async prepareUpload(opts: PrepareUploadOpts): Promise<PreparedUpload> {
    const slug = nameToSlug(opts.uploaderName)
    const subfolderId = await this.getOrCreateSubfolder(slug)

    const accessToken = await this.getAccessToken()

    // Store under the nanoid photoId + extension (consistent with local/R2),
    // not the user-supplied original filename.
    const ext = opts.fileName.split(".").pop()?.toLowerCase() || "jpg"
    const metadataBody = JSON.stringify({
      name: `${opts.photoId}.${ext}`,
      parents: [subfolderId],
    })

    // Initiate a resumable upload session
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "Content-Length": String(new TextEncoder().encode(metadataBody).length),
          "X-Upload-Content-Type": opts.mimeType,
          "X-Upload-Content-Length": String(opts.fileSize),
        },
        body: metadataBody,
      },
    )

    const uploadUrl = initResponse.headers.get("location") ?? null

    // storageKey is a placeholder — after client uploads, the Drive API returns the
    // actual file ID. The client sends it back via POST /api/upload/complete { driveFileId }.
    const storageKey = `pending:${opts.photoId}`

    return {
      photoId: opts.photoId,
      storageKey,
      uploadUrl,
      uploadMethod: "POST",
      uploadHeaders: {
        "Content-Type": opts.mimeType,
        "Content-Length": String(opts.fileSize),
      },
      expiresAt: Math.floor(Date.now() / 1000) + PRESIGNED_URL_EXPIRY_SECONDS,
    }
  }

  async verifyUpload(key: string): Promise<boolean> {
    if (key.startsWith("pending:")) return false
    const drive = this.getDriveClient()
    try {
      await drive.files.get({ fileId: key, fields: "id", supportsAllDrives: true })
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    // Direct download link — requires file to be shared publicly or via service account
    return `https://drive.google.com/uc?id=${key}&export=download`
  }

  async deleteFile(key: string): Promise<void> {
    if (key.startsWith("pending:")) return
    const drive = this.getDriveClient()
    await drive.files.delete({ fileId: key, supportsAllDrives: true })
  }

  async downloadToPath(key: string, destPath: string): Promise<boolean> {
    const result = await this.fetchObject(key)
    if (!result.ok) return false
    const bytes = await new Response(result.value.body).arrayBuffer().catch(() => null)
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
    const drive = this.getDriveClient()

    // Find the folder that holds the original file so the transcoded version lands alongside it.
    const original = await drive.files
      .get({ fileId: originalKey, fields: "parents", supportsAllDrives: true })
      .catch(() => null)
    const parentId = original?.data.parents?.[0]
    if (!parentId) return null

    const bytes = await readFile(srcPath).catch(() => null)
    if (!bytes) return null

    const fileName = destKey.split("/").pop() ?? destKey
    const created = await drive.files
      .create({
        requestBody: { name: fileName, parents: [parentId] },
        media: { mimeType, body: bytes },
        supportsAllDrives: true,
        fields: "id",
      })
      .catch(() => null)
    return created?.data.id ?? null
  }

  async fetchObject(key: string): Promise<FetchObjectResult> {
    if (key.startsWith("pending:")) return { ok: false }
    const accessToken = await this.getAccessToken().catch(() => null)
    if (!accessToken) return { ok: false }
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(key)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).catch(() => null)
    if (!res?.ok || !res.body) return { ok: false }
    return { ok: true, value: { body: res.body } }
  }
}
