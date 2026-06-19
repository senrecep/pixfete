import { access, mkdir, unlink } from "node:fs/promises"
import { join, resolve } from "node:path"
import { PRESIGNED_URL_EXPIRY_SECONDS } from "@pixfete/shared"
import type { StorageProvider } from "@pixfete/shared"
import { nameToSlug, sanitizeFileName } from "../pathUtils"
import type { PrepareUploadOpts, PreparedUpload, StorageAdapter } from "../types"

export interface LocalStorageConfig {
  uploadsDir: string
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider: StorageProvider = "local"
  private readonly uploadsDir: string

  constructor(config: LocalStorageConfig) {
    this.uploadsDir = resolve(config.uploadsDir)
  }

  async prepareUpload(opts: PrepareUploadOpts): Promise<PreparedUpload> {
    const slug = nameToSlug(opts.uploaderName)
    const sanitized = sanitizeFileName(opts.fileName)
    // storageKey is relative to uploadsDir: {slug}/{photoId}/{fileName}
    const storageKey = `${slug}/${opts.photoId}/${sanitized}`
    await mkdir(join(this.uploadsDir, slug, opts.photoId), { recursive: true })

    return {
      photoId: opts.photoId,
      storageKey,
      uploadUrl: null,
      uploadMethod: null,
      uploadHeaders: {},
      expiresAt: Math.floor(Date.now() / 1000) + PRESIGNED_URL_EXPIRY_SECONDS,
    }
  }

  async verifyUpload(key: string): Promise<boolean> {
    try {
      await access(this.resolveLocalPath(key))
      return true
    } catch {
      return false
    }
  }

  getPublicUrl(key: string): string {
    // Served by GET /api/uploads/* in the API
    return `/api/uploads/${key}`
  }

  async deleteFile(key: string): Promise<void> {
    await unlink(this.resolveLocalPath(key))
  }

  /** Resolves storageKey to an absolute path, preventing path traversal. */
  resolveLocalPath(key: string): string {
    const abs = resolve(join(this.uploadsDir, key))
    if (!abs.startsWith(this.uploadsDir)) {
      throw new Error("Path traversal attempt detected")
    }
    return abs
  }
}
