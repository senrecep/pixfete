import { GoogleDriveAdapter } from "./adapters/gdrive"
import { LocalStorageAdapter } from "./adapters/local"
import { R2StorageAdapter } from "./adapters/r2"
import type { StorageAdapter, StorageEnv } from "./types"

function requireEnv(env: StorageEnv, key: keyof StorageEnv, provider: string): string {
  const value = env[key]
  if (!value) {
    throw new Error(`Storage provider "${provider}" requires env var ${key} but it is not set`)
  }
  return value
}

export function createStorageAdapter(env: StorageEnv): StorageAdapter {
  const provider = env.STORAGE_PROVIDER ?? "local"

  if (provider === "r2") {
    const endpoint = requireEnv(env, "R2_ENDPOINT", "r2")
    const accessKeyId = requireEnv(env, "R2_ACCESS_KEY_ID", "r2")
    const secretAccessKey = requireEnv(env, "R2_SECRET_ACCESS_KEY", "r2")
    const bucket = requireEnv(env, "R2_BUCKET", "r2")
    const publicUrl = requireEnv(env, "R2_PUBLIC_URL", "r2")

    return new R2StorageAdapter({
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicUrl,
    })
  }

  if (provider === "gdrive") {
    const serviceAccountJson = requireEnv(env, "GDRIVE_SERVICE_ACCOUNT_JSON", "gdrive")
    const folderId = requireEnv(env, "GDRIVE_FOLDER_ID", "gdrive")

    return new GoogleDriveAdapter({
      serviceAccountJson,
      folderId,
    })
  }

  // Default: local
  const uploadsDir = env.UPLOADS_DIR ?? "./uploads"
  return new LocalStorageAdapter({ uploadsDir })
}
