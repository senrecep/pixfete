import { z } from "zod"
import { ALLOWED_MIME_TYPES, EVENT_TYPES, PHOTO_STATUSES, STORAGE_PROVIDERS } from "../constants"

/** Photo IDs are nanoid-generated, url-safe tokens (not UUIDs). */
const photoIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid photo id")

export const CreateUploadSessionSchema = z.object({
  uploaderName: z
    .string()
    .min(2, "Ad soyad en az 2 karakter olmalıdır")
    .max(100, "Ad soyad en fazla 100 karakter olabilir")
    .trim(),
  uploaderPhone: z
    .string()
    .regex(/^[\d\s\+\-\(\)]{7,20}$/, "Geçerli bir telefon numarası girin")
    .optional()
    .nullable(),
})
export type CreateUploadSessionInput = z.infer<typeof CreateUploadSessionSchema>

export const PrepareUploadSchema = z.object({
  sessionId: z.string().uuid(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        fileSize: z.number().int().positive(),
        mimeType: z.enum(ALLOWED_MIME_TYPES),
        width: z.number().int().positive().optional().nullable(),
        height: z.number().int().positive().optional().nullable(),
      }),
    )
    .min(1)
    .max(30),
})
export type PrepareUploadInput = z.infer<typeof PrepareUploadSchema>

export const CompleteUploadSchema = z.object({
  photoId: photoIdSchema,
  storageEtag: z.string().optional(),
  // GDrive only: the file ID returned by the Drive API after resumable upload completes
  driveFileId: z.string().optional(),
})
export type CompleteUploadInput = z.infer<typeof CompleteUploadSchema>

export const AdminLoginSchema = z.object({
  password: z.string().min(1),
})
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>

export const BulkPhotoActionSchema = z.object({
  photoIds: z.array(photoIdSchema).min(1).max(500),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
})
export type BulkPhotoActionInput = z.infer<typeof BulkPhotoActionSchema>

export const PhotoFilterSchema = z.object({
  status: z.enum([...PHOTO_STATUSES, "all"]).default("all"),
  sessionId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export type PhotoFilterInput = z.infer<typeof PhotoFilterSchema>

export const AnalyticsFilterSchema = z.object({
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  eventType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
export type AnalyticsFilterInput = z.infer<typeof AnalyticsFilterSchema>

// ── App settings (admin-managed configuration) ────────────────────────────────

export const EventConfigSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().max(120),
  subtitle: z.string().max(200),
  date: z.string().max(40), // ISO datetime, empty allowed
  venueName: z.string().max(200),
  venueAddress: z.string().max(300),
  venueMapsUrl: z.string().max(500),
  // Optional pinned coordinates (from location search or manual entry).
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  hostsLeft: z.string().max(120),
  hostsRight: z.string().max(120),
  accentColor: z.string().max(32),
  // Optional admin overrides for type-preset copy (blank = use the type preset).
  overrides: z.object({
    welcome: z.string().max(200),
    galleryTitle: z.string().max(120),
  }),
})

export const StorageSettingsSchema = z.object({
  provider: z.enum(STORAGE_PROVIDERS),
  basePath: z.string().max(200),
  uploadsDir: z.string().max(300),
  r2: z.object({
    endpoint: z.string().max(500),
    accessKey: z.string().max(300),
    secretKey: z.string().max(500),
    bucket: z.string().max(200),
    publicUrl: z.string().max(500),
  }),
  gdrive: z.object({
    serviceAccountJson: z.string(),
    folderId: z.string().max(200),
  }),
})

export const UploadLimitsSchema = z.object({
  maxFileSizeMb: z.number().int().positive().max(500),
  maxFilesPerSession: z.number().int().positive().max(1000),
  rateLimitUploadsPerHour: z.number().int().positive().max(100000),
})

export const FeatureFlagsSchema = z.object({
  phoneField: z.boolean(),
})

export const LocaleSchema = z.enum(["en", "tr"])

export const AppSettingsSchema = z.object({
  event: EventConfigSchema,
  storage: StorageSettingsSchema,
  upload: UploadLimitsSchema,
  features: FeatureFlagsSchema,
  // UI language served to every guest; admin-controlled, defaults to English.
  locale: LocaleSchema,
})
export type AppSettingsInput = z.infer<typeof AppSettingsSchema>

/** Admin PATCH payload — every level optional; omitted secrets keep their value. */
export const UpdateSettingsSchema = z.object({
  event: EventConfigSchema.partial().optional(),
  storage: StorageSettingsSchema.partial()
    .extend({
      r2: StorageSettingsSchema.shape.r2.partial().optional(),
      gdrive: StorageSettingsSchema.shape.gdrive.partial().optional(),
    })
    .optional(),
  upload: UploadLimitsSchema.partial().optional(),
  features: FeatureFlagsSchema.partial().optional(),
  locale: LocaleSchema.optional(),
})
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>

export const DEFAULT_SETTINGS: AppSettingsInput = {
  event: {
    type: "wedding",
    title: "",
    subtitle: "",
    date: "",
    venueName: "",
    venueAddress: "",
    venueMapsUrl: "",
    lat: null,
    lng: null,
    hostsLeft: "",
    hostsRight: "",
    accentColor: "#9b72aa",
    overrides: { welcome: "", galleryTitle: "" },
  },
  storage: {
    provider: "local",
    basePath: "",
    uploadsDir: "./uploads",
    r2: { endpoint: "", accessKey: "", secretKey: "", bucket: "", publicUrl: "" },
    gdrive: { serviceAccountJson: "", folderId: "" },
  },
  upload: { maxFileSizeMb: 50, maxFilesPerSession: 30, rateLimitUploadsPerHour: 50 },
  features: { phoneField: true },
  locale: "en",
}
