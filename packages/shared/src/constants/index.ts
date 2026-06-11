export const STORAGE_PROVIDERS = ["local", "r2", "gdrive"] as const
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number]

export const PHOTO_STATUSES = ["pending", "approved", "rejected"] as const
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export const EVENT_TYPES = ["wedding", "engagement", "birthday", "corporate", "generic"] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const ANALYTICS_EVENTS = [
  "page_view",
  "upload_session_start",
  "upload_complete",
  "upload_error",
  "gallery_view",
  "my_photos_view",
  "admin_login",
  "admin_logout",
  "photo_approved",
  "photo_rejected",
  "qr_generated",
  "pdf_downloaded",
] as const
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100MB hard cap
export const VIEWER_TOKEN_BYTES = 32
export const ADMIN_JWT_EXPIRY_SECONDS = 60 * 60 * 8 // 8 hours
export const PRESIGNED_URL_EXPIRY_SECONDS = 60 * 15 // 15 minutes
export const CHUNK_SIZE_BYTES = 2 * 1024 * 1024 // 2MB chunks for local upload
