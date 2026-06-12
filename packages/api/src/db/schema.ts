import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const uploadSessions = sqliteTable("upload_sessions", {
  id: text("id").primaryKey(),
  uploaderName: text("uploader_name").notNull(),
  uploaderPhone: text("uploader_phone"),
  uploaderNote: text("uploader_note"),
  viewerToken: text("viewer_token").notNull().unique(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  uploaderSessionId: text("uploader_session_id")
    .notNull()
    .references(() => uploadSessions.id),
  fileName: text("file_name").notNull(),
  originalSize: integer("original_size").notNull(),
  storageType: text("storage_type").notNull(), // 'local' | 'r2' | 'gdrive'
  storageKey: text("storage_key").notNull(),
  publicUrl: text("public_url"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  // Derived (local-only) web-friendly H.264 mp4 + JPEG poster, produced by the
  // background transcode job for HEVC/.mov videos. Null until/unless transcoded.
  transcodedKey: text("transcoded_key"),
  posterKey: text("poster_key"),
  uploadedAt: integer("uploaded_at").notNull(),
  approvedAt: integer("approved_at"),
  rejectedAt: integer("rejected_at"),
  rejectionReason: text("rejection_reason"),
  uploadComplete: integer("upload_complete", { mode: "boolean" }).notNull().default(false),
})

export const analyticsEvents = sqliteTable("analytics_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  sessionId: text("session_id"),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  metadata: text("metadata").notNull().default("{}"), // JSON string
  createdAt: integer("created_at").notNull(),
})

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  ipAddress: text("ip_address").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
})

// Single-row table (id always 1) holding the admin-managed settings JSON.
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  data: text("data").notNull(), // JSON AppSettings (secrets encrypted)
  updatedAt: integer("updated_at").notNull(),
})

export type UploadSessionRow = typeof uploadSessions.$inferSelect
export type PhotoRow = typeof photos.$inferSelect
export type AnalyticsEventRowDb = typeof analyticsEvents.$inferSelect
export type AdminSessionRow = typeof adminSessions.$inferSelect
export type AppSettingsRow = typeof appSettings.$inferSelect
