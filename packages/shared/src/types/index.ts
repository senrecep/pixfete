import type { EventType, PhotoStatus, StorageProvider } from "../constants"

export interface Photo {
  id: string
  uploaderSessionId: string
  uploaderName: string
  uploaderPhone: string | null
  uploaderNote: string | null
  fileName: string
  originalSize: number
  storageType: StorageProvider
  storageKey: string
  publicUrl: string | null
  status: PhotoStatus
  mimeType: string
  width: number | null
  height: number | null
  /** Local-only derived H.264 mp4 for cross-browser playback (null until transcoded). */
  transcodedKey: string | null
  /** Local-only derived JPEG poster frame (null until transcoded). */
  posterKey: string | null
  uploadedAt: number
  approvedAt: number | null
  rejectedAt: number | null
  rejectionReason: string | null
}

export interface UploadSession {
  id: string
  uploaderName: string
  uploaderPhone: string | null
  uploaderNote: string | null
  viewerToken: string
  ipAddress: string
  userAgent: string
  createdAt: number
  photoCount: number
  approvedCount: number
  pendingCount: number
  totalSize: number
}

export interface AnalyticsEventRow {
  id: string
  eventType: string
  sessionId: string | null
  ipAddress: string
  userAgent: string
  metadata: Record<string, unknown>
  createdAt: number
}

export interface AdminSession {
  id: string
  ipAddress: string
  createdAt: number
  expiresAt: number
}

export interface EventConfig {
  type: EventType
  title: string
  subtitle: string
  date: string
  venueName: string
  venueAddress: string
  venueMapsUrl: string
  whatsappNumber: string
  lat: number | null
  lng: number | null
  hostsLeft: string
  hostsRight: string
  accentColor: string
  overrides: {
    welcome: string
    galleryTitle: string
  }
}

export interface FeatureFlags {
  phoneField: boolean
  noteField: boolean
}

/** UI language. Fixed by the admin; the same locale is served to every guest. */
export type Locale = "en" | "tr"

/** Upload limits exposed publicly so the uploader UI can validate client-side. */
export interface PublicUploadLimits {
  maxFileSizeMb: number
  maxFilesPerSession: number
}

/** Public, non-secret settings served to the web app at runtime. */
export interface PublicSettings {
  event: EventConfig
  features: FeatureFlags
  upload: PublicUploadLimits
  locale: Locale
}

/** Admin settings view — secrets are never returned, only a "set" marker. */
export interface AdminStorageSettings {
  provider: StorageProvider
  basePath: string
  uploadsDir: string
  r2: {
    endpoint: string
    accessKey: string
    bucket: string
    publicUrl: string
    secretKeySet: boolean
  }
  gdrive: {
    folderId: string
    serviceAccountJsonSet: boolean
  }
}

export interface AdminUploadSettings {
  maxFileSizeMb: number
  maxFilesPerSession: number
  rateLimitUploadsPerHour: number
}

export interface AdminSettings {
  event: EventConfig
  storage: AdminStorageSettings
  upload: AdminUploadSettings
  features: FeatureFlags
  locale: Locale
}

export interface DashboardStats {
  totalPhotos: number
  pendingPhotos: number
  approvedPhotos: number
  rejectedPhotos: number
  totalUploaders: number
  totalStorageBytes: number
  uploadsToday: number
  uploadsThisWeek: number
}

export interface UploaderStats {
  sessionId: string
  uploaderName: string
  uploaderPhone: string | null
  uploaderNote: string | null
  photoCount: number
  approvedCount: number
  pendingCount: number
  totalSizeBytes: number
  firstUploadAt: number
  lastUploadAt: number
  ipAddress: string
}
