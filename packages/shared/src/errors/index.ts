import { Err } from "tsentials/errors"

export const PixfeteErr = {
  // Upload errors
  fileTooLarge: (maxMb: number) =>
    Err.validation("Upload.FileTooLarge", `File exceeds ${maxMb}MB limit`),
  invalidMimeType: (type: string) =>
    Err.validation("Upload.InvalidMimeType", `File type not allowed: ${type}`),
  sessionNotFound: () => Err.notFound("Upload.SessionNotFound", "Upload session not found"),
  sessionExpired: () => Err.forbidden("Upload.SessionExpired", "Upload session has expired"),
  tooManyFiles: (max: number) =>
    Err.validation("Upload.TooManyFiles", `Maximum ${max} files per session`),
  presignFailed: (reason: string) =>
    Err.unexpected("Upload.PresignFailed", `Failed to generate upload URL: ${reason}`),
  storageFailed: (reason: string) =>
    Err.unexpected("Upload.StorageFailed", `Storage operation failed: ${reason}`),
  uploadNotComplete: () =>
    Err.validation("Upload.NotComplete", "Upload has not been completed yet"),

  // Auth errors
  invalidCredentials: () => Err.forbidden("Auth.InvalidCredentials", "Invalid password"),
  sessionInvalid: () => Err.forbidden("Auth.SessionInvalid", "Admin session is invalid or expired"),
  rateLimited: () => Err.forbidden("Auth.RateLimited", "Too many requests, please slow down"),

  // Photo errors
  photoNotFound: () => Err.notFound("Photo.NotFound", "Photo not found"),
  alreadyProcessed: () =>
    Err.validation("Photo.AlreadyProcessed", "Photo has already been approved or rejected"),

  // Config errors
  storageNotConfigured: (provider: string) =>
    Err.unexpected(
      "Config.StorageNotConfigured",
      `Storage provider "${provider}" is not configured`,
    ),
  invalidSettings: (reason: string) =>
    Err.validation("Settings.Invalid", `Invalid settings: ${reason}`),
}
