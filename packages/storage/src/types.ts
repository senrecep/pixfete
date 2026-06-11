import type { StorageProvider } from "@pixfete/shared"

export interface StorageAdapter {
  // For R2/GDrive: returns presigned upload URL + unique storage key
  // For local: returns null (use chunk upload endpoint)
  prepareUpload(opts: PrepareUploadOpts): Promise<PreparedUpload>

  // For R2: verify object exists via headObject
  // For local: verify file exists on disk
  // For GDrive: verify file ID exists
  verifyUpload(key: string): Promise<boolean>

  // Generate public serving URL for approved photo
  getPublicUrl(key: string): string

  // Delete file from storage
  deleteFile(key: string): Promise<void>

  // Get storage type identifier
  readonly provider: StorageProvider
}

export interface PrepareUploadOpts {
  photoId: string
  fileName: string
  fileSize: number
  mimeType: string
  uploaderName: string
}

export interface PreparedUpload {
  photoId: string
  storageKey: string
  // For R2/GDrive: client uploads directly to this URL
  // For local: null — use POST /api/upload/chunk/:photoId
  uploadUrl: string | null
  // HTTP method for direct upload (PUT for R2, POST for GDrive resumable)
  uploadMethod: "PUT" | "POST" | null
  // Additional headers the client must send with the upload request
  uploadHeaders: Record<string, string>
  expiresAt: number // Unix timestamp
}

export interface StorageEnv {
  STORAGE_PROVIDER?: string
  // R2
  R2_ENDPOINT?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET?: string
  R2_PUBLIC_URL?: string
  // GDrive
  GDRIVE_SERVICE_ACCOUNT_JSON?: string
  GDRIVE_FOLDER_ID?: string
  // Local
  UPLOADS_DIR?: string
}
