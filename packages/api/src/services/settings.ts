import { AppSettingsSchema, DEFAULT_SETTINGS, PixfeteErr } from "@pixfete/shared"
import type {
  AdminSettings,
  AppSettingsInput,
  PublicSettings,
  UpdateSettingsInput,
} from "@pixfete/shared"
import { eq } from "drizzle-orm"
import { Result as R } from "tsentials/result"
import type { Result } from "tsentials/result"
import { db } from "../db"
import { appSettings } from "../db/schema"
import { decryptSecret, encryptSecret } from "./crypto"

// In-memory cache of the fully-decrypted settings. A version counter lets other
// modules (storage) detect changes without importing this one (avoids cycles).
let cache: AppSettingsInput | null = null
let version = 0

// ── helpers ───────────────────────────────────────────────────────────────────

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined || patch === null) return base
  if (typeof base !== "object" || base === null || Array.isArray(base)) return patch as T
  const out = { ...(base as Record<string, unknown>) }
  for (const k of Object.keys(patch as Record<string, unknown>)) {
    out[k] = deepMerge(out[k], (patch as Record<string, unknown>)[k])
  }
  return out as T
}

function withEncryptedSecrets(s: AppSettingsInput): AppSettingsInput {
  const c = structuredClone(s)
  c.storage.r2.secretKey = encryptSecret(c.storage.r2.secretKey)
  c.storage.gdrive.serviceAccountJson = encryptSecret(c.storage.gdrive.serviceAccountJson)
  return c
}

function withDecryptedSecrets(s: AppSettingsInput): AppSettingsInput {
  const c = structuredClone(s)
  c.storage.r2.secretKey = decryptSecret(c.storage.r2.secretKey)
  c.storage.gdrive.serviceAccountJson = decryptSecret(c.storage.gdrive.serviceAccountJson)
  return c
}

function envStr(key: string, fallback: string): string {
  const v = process.env[key]
  return v !== undefined && v !== "" ? v : fallback
}
function envNum(key: string, fallback: number): number {
  const v = process.env[key]
  return v !== undefined && v !== "" ? Number(v) : fallback
}
function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key]
  return v !== undefined && v !== "" ? v === "true" : fallback
}

/** First-boot seed: prefer legacy env vars (smooth migration), else defaults. */
function envSeed(): AppSettingsInput {
  const d = DEFAULT_SETTINGS
  const provider = process.env.STORAGE_PROVIDER
  return {
    event: {
      type: ((): AppSettingsInput["event"]["type"] => {
        const v = process.env.EVENT_TYPE
        return v === "wedding" ||
          v === "engagement" ||
          v === "birthday" ||
          v === "corporate" ||
          v === "generic"
          ? v
          : d.event.type
      })(),
      title: envStr("EVENT_TITLE", d.event.title),
      subtitle: envStr("EVENT_SUBTITLE", d.event.subtitle),
      date: envStr("EVENT_DATE", d.event.date),
      venueName: envStr("EVENT_VENUE_NAME", d.event.venueName),
      venueAddress: envStr("EVENT_VENUE_ADDRESS", d.event.venueAddress),
      venueMapsUrl: envStr("EVENT_VENUE_MAPS_URL", d.event.venueMapsUrl),
      whatsappNumber: envStr("EVENT_WHATSAPP_NUMBER", d.event.whatsappNumber),
      lat: d.event.lat,
      lng: d.event.lng,
      hostsLeft: envStr("EVENT_HOSTS_LEFT", d.event.hostsLeft),
      hostsRight: envStr("EVENT_HOSTS_RIGHT", d.event.hostsRight),
      accentColor: envStr("EVENT_ACCENT_COLOR", d.event.accentColor),
      overrides: { welcome: "", galleryTitle: "" },
    },
    storage: {
      provider: provider === "r2" || provider === "gdrive" ? provider : d.storage.provider,
      basePath: envStr("STORAGE_BASE_PATH", d.storage.basePath),
      uploadsDir: envStr("UPLOADS_DIR", d.storage.uploadsDir),
      r2: {
        endpoint: envStr("CLOUDFLARE_R2_ENDPOINT", d.storage.r2.endpoint),
        accessKey: envStr("CLOUDFLARE_R2_ACCESS_KEY", d.storage.r2.accessKey),
        secretKey: envStr("CLOUDFLARE_R2_SECRET_KEY", d.storage.r2.secretKey),
        bucket: envStr("CLOUDFLARE_R2_BUCKET", d.storage.r2.bucket),
        publicUrl: envStr("CLOUDFLARE_R2_PUBLIC_URL", d.storage.r2.publicUrl),
      },
      gdrive: {
        serviceAccountJson: envStr(
          "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
          d.storage.gdrive.serviceAccountJson,
        ),
        folderId: envStr("GOOGLE_DRIVE_FOLDER_ID", d.storage.gdrive.folderId),
      },
    },
    upload: {
      maxFileSizeMb: envNum("UPLOAD_MAX_FILE_SIZE_MB", d.upload.maxFileSizeMb),
      maxFilesPerSession: envNum("UPLOAD_MAX_FILES_PER_SESSION", d.upload.maxFilesPerSession),
      rateLimitUploadsPerHour: envNum(
        "RATE_LIMIT_UPLOADS_PER_HOUR",
        d.upload.rateLimitUploadsPerHour,
      ),
    },
    features: {
      phoneField: envBool("FEATURE_PHONE_FIELD", d.features.phoneField),
      noteField: envBool("FEATURE_NOTE_FIELD", d.features.noteField),
    },
    locale: process.env.DEFAULT_LOCALE === "tr" ? "tr" : d.locale,
  }
}

function persist(decrypted: AppSettingsInput): void {
  const data = JSON.stringify(withEncryptedSecrets(decrypted))
  const updatedAt = Date.now()
  db.insert(appSettings)
    .values({ id: 1, data, updatedAt })
    .onConflictDoUpdate({ target: appSettings.id, set: { data, updatedAt } })
    .run()
}

function load(): AppSettingsInput {
  if (cache) return cache
  const row = db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1).all()[0]
  if (!row) {
    const seeded = envSeed()
    persist(seeded)
    cache = seeded
    return cache
  }
  const parsedRow = R.try(() => JSON.parse(row.data) as AppSettingsInput)
  const stored = R.isSuccess(parsedRow) ? parsedRow.value : structuredClone(DEFAULT_SETTINGS)
  const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), withDecryptedSecrets(stored))
  const parsed = AppSettingsSchema.safeParse(merged)
  cache = parsed.success ? parsed.data : structuredClone(DEFAULT_SETTINGS)
  return cache
}

// ── public API ──────────────────────────────────────────────────────────────

/** Full, decrypted settings for internal use (storage, upload limits). */
export function getSettings(): AppSettingsInput {
  return load()
}

/** Non-secret settings served to the web app. */
export function getPublicSettings(): PublicSettings {
  const s = load()
  return {
    event: s.event,
    features: s.features,
    upload: {
      maxFileSizeMb: s.upload.maxFileSizeMb,
      maxFilesPerSession: s.upload.maxFilesPerSession,
    },
    locale: s.locale,
  }
}

/** Admin view — secret values replaced with "set" markers. */
export function getAdminSettings(): AdminSettings {
  const s = load()
  return {
    event: s.event,
    storage: {
      provider: s.storage.provider,
      basePath: s.storage.basePath,
      uploadsDir: s.storage.uploadsDir,
      r2: {
        endpoint: s.storage.r2.endpoint,
        accessKey: s.storage.r2.accessKey,
        bucket: s.storage.r2.bucket,
        publicUrl: s.storage.r2.publicUrl,
        secretKeySet: s.storage.r2.secretKey.length > 0,
      },
      gdrive: {
        folderId: s.storage.gdrive.folderId,
        serviceAccountJsonSet: s.storage.gdrive.serviceAccountJson.length > 0,
      },
    },
    upload: s.upload,
    features: s.features,
    locale: s.locale,
  }
}

/** Drop empty secret fields so an omitted secret keeps its current value. */
function stripEmptySecrets(patch: UpdateSettingsInput): UpdateSettingsInput {
  const p = structuredClone(patch)
  if (p.storage?.r2 && !p.storage.r2.secretKey) {
    p.storage.r2.secretKey = undefined
  }
  if (p.storage?.gdrive && !p.storage.gdrive.serviceAccountJson) {
    p.storage.gdrive.serviceAccountJson = undefined
  }
  return p
}

export function updateSettings(patch: UpdateSettingsInput): Result<AdminSettings> {
  const current = load()
  const merged = deepMerge(structuredClone(current), stripEmptySecrets(patch))
  const parsed = AppSettingsSchema.safeParse(merged)
  if (!parsed.success) {
    return R.failure(PixfeteErr.invalidSettings(parsed.error.issues[0]?.message ?? "invalid input"))
  }
  persist(parsed.data)
  cache = parsed.data
  version += 1
  return R.success(getAdminSettings())
}

/** Monotonic counter; bumps on every successful update. */
export function settingsVersion(): number {
  return version
}
