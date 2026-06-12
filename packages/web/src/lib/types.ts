// Frontend-facing API response & request types.
// Mirrors the @pixfete/api response envelopes.
import type {
  AnalyticsEventRow,
  DashboardStats,
  Photo,
  StorageProvider,
  UploaderStats,
} from "@pixfete/shared"

export type {
  AdminSettings,
  AnalyticsEventRow,
  DashboardStats,
  EventConfig,
  EventType,
  FeatureFlags,
  Locale,
  Photo,
  PhotoStatus,
  PublicSettings,
  PublicUploadLimits,
  StorageProvider,
  UpdateSettingsInput,
  UploadSession,
  UploaderStats,
} from "@pixfete/shared"

export interface CreateSessionResponse {
  sessionId: string
  viewerToken: string
}

export interface ResumeSessionResponse {
  sessionId: string
  viewerToken: string
  viewerUrl: string
  uploaderName: string
}

// A single prepared upload slot returned by /api/upload/prepare.
export interface PreparedUpload {
  photoId: string
  fileName: string
  storageType: StorageProvider
  // For r2 / gdrive: a presigned URL the client PUTs/POSTs the file to.
  // For local: null (use uploadLocalChunk instead).
  uploadUrl: string | null
  uploadMethod: "PUT" | "POST"
  // Extra form fields required by some presigned POST flows (e.g. S3 POST policy).
  fields?: Record<string, string> | null
  headers?: Record<string, string> | null
}

export interface PrepareUploadResponse {
  uploads: PreparedUpload[]
}

export interface CompleteUploadResponse {
  photo: Photo
}

export interface PaginatedPhotos {
  photos: Photo[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface MyPhotosResponse {
  uploaderName: string
  photos: Photo[]
}

export interface AdminLoginResponse {
  success: boolean
}

export interface UpdatePhotoResponse {
  photo: Photo
}

export interface BulkActionResponse {
  updated: number
}

export interface DeletePhotoResponse {
  success: boolean
}

export interface PaginatedUploaders {
  uploaders: UploaderStats[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AnalyticsResponse {
  totalEvents: number
  uniqueIps: number
  uploadsByDay: Array<{ date: string; count: number }>
  events: AnalyticsEventRow[]
  page: number
  limit: number
  total: number
}

export interface DashboardResponse {
  stats: DashboardStats
  recentUploads: Photo[]
  recentEvents: AnalyticsEventRow[]
}

export interface ApiError {
  code: string
  message: string
}

// GET /api/event now returns public settings (event config + feature flags).
export type { PublicSettings as EventInfo } from "@pixfete/shared"
