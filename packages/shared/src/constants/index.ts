export const STORAGE_PROVIDERS = ["local", "r2", "gdrive"] as const
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number]

export const PHOTO_STATUSES = ["pending", "approved", "rejected"] as const
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export const EVENT_TYPES = ["wedding", "engagement", "birthday", "corporate", "generic"] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
] as const
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number]

export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** True if the MIME type is one of the supported video formats. */
export function isVideoMime(mimeType: string): boolean {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)
}

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

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2GB hard cap (videos allowed)
export const VIEWER_TOKEN_BYTES = 32
export const ADMIN_JWT_EXPIRY_SECONDS = 60 * 60 * 8 // 8 hours
export const PRESIGNED_URL_EXPIRY_SECONDS = 60 * 15 // 15 minutes
export const CHUNK_SIZE_BYTES = 2 * 1024 * 1024 // 2MB chunks for local upload
