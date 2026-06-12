// Typed API client — all fetch calls go through here.
import type {
  AnalyticsFilterInput,
  BulkPhotoActionInput,
  PhotoFilterInput,
  PrepareUploadInput,
} from "@pixfete/shared"
import { CHUNK_SIZE_BYTES } from "@pixfete/shared"
import type {
  AdminLoginResponse,
  AdminSettings,
  AnalyticsResponse,
  BulkActionResponse,
  CompleteUploadResponse,
  CreateSessionResponse,
  DashboardResponse,
  DeletePhotoResponse,
  EventInfo,
  MyPhotosResponse,
  PaginatedPhotos,
  PaginatedUploaders,
  PrepareUploadResponse,
  ResumeSessionResponse,
  UpdatePhotoResponse,
  UpdateSettingsInput,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export class ApiClientError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "ApiClientError"
    this.code = code
    this.status = status
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let code = "Unknown"
    let message = `Request failed with status ${res.status}`
    try {
      const data = (await res.json()) as { code?: string; message?: string; error?: string }
      code = data.code ?? code
      message = data.message ?? data.error ?? message
    } catch {
      // non-JSON error body, keep defaults
    }
    throw new ApiClientError(code, message, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export const api = {
  event: {
    getInfo: () => request<EventInfo>("/api/event"),
  },

  upload: {
    createSession: (body: {
      uploaderName: string
      uploaderPhone?: string
      uploaderNote?: string
    }) =>
      request<CreateSessionResponse>("/api/upload/session", {
        method: "POST",
        body,
      }),

    resumeSession: (viewerToken: string) =>
      request<ResumeSessionResponse>("/api/upload/session/resume", {
        method: "POST",
        body: { viewerToken },
      }),

    prepare: (body: PrepareUploadInput) =>
      request<PrepareUploadResponse>("/api/upload/prepare", {
        method: "POST",
        body,
      }),

    complete: (photoId: string, driveFileId?: string) =>
      request<CompleteUploadResponse>("/api/upload/complete", {
        method: "POST",
        body: driveFileId ? { photoId, driveFileId } : { photoId },
      }),

    // Direct client -> storage upload for r2 / gdrive via presigned URL.
    // Resolves with the raw response body — empty for R2 (PUT), but for GDrive
    // the resumable endpoint returns the file metadata JSON containing its `id`.
    uploadToStorage: (
      uploadUrl: string,
      method: "PUT" | "POST",
      file: File,
      onProgress: (p: number) => void,
      headers?: Record<string, string> | null,
      fields?: Record<string, string> | null,
    ): Promise<string> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open(method, uploadUrl, true)
        if (method === "PUT") {
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        }
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            // Content-Length is a forbidden header — the browser sets it itself
            // and rejects manual attempts (noisy console warning). Skip it.
            if (key.toLowerCase() === "content-length") continue
            xhr.setRequestHeader(key, value)
          }
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onProgress(100)
            resolve(xhr.responseText)
          } else {
            reject(new ApiClientError("Upload.StorageFailed", "Storage upload failed", xhr.status))
          }
        }
        xhr.onerror = () =>
          reject(new ApiClientError("Upload.StorageFailed", "Network error during upload", 0))

        if (method === "POST" && fields) {
          const form = new FormData()
          for (const [key, value] of Object.entries(fields)) {
            form.append(key, value)
          }
          form.append("file", file)
          xhr.send(form)
        } else {
          xhr.send(file)
        }
      }),

    // Chunked upload to local storage backend with progress tracking.
    uploadLocalChunk: (
      photoId: string,
      file: File,
      onProgress: (p: number) => void,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES))
        let chunkIndex = 0

        const sendNext = (): void => {
          if (chunkIndex >= totalChunks) {
            onProgress(100)
            resolve()
            return
          }
          const start = chunkIndex * CHUNK_SIZE_BYTES
          const end = Math.min(start + CHUNK_SIZE_BYTES, file.size)
          const chunk = file.slice(start, end)

          const xhr = new XMLHttpRequest()
          xhr.open("POST", `${API_URL}/api/upload/local/${photoId}`, true)
          xhr.withCredentials = true
          xhr.setRequestHeader("Content-Type", "application/octet-stream")
          xhr.setRequestHeader("X-Chunk-Index", String(chunkIndex))
          xhr.setRequestHeader("X-Total-Chunks", String(totalChunks))

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const chunkFraction = (start + e.loaded) / file.size
              onProgress(Math.min(99, Math.round(chunkFraction * 100)))
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              chunkIndex += 1
              sendNext()
            } else {
              reject(
                new ApiClientError("Upload.StorageFailed", "Local chunk upload failed", xhr.status),
              )
            }
          }
          xhr.onerror = () =>
            reject(new ApiClientError("Upload.StorageFailed", "Network error during upload", 0))
          xhr.send(chunk)
        }

        sendNext()
      }),
  },

  photos: {
    getApproved: (page = 1) => request<PaginatedPhotos>(`/api/photos?page=${page}`),

    getMine: (token: string) =>
      request<MyPhotosResponse>(`/api/photos/mine/${encodeURIComponent(token)}`),
  },

  admin: {
    login: (password: string) =>
      request<AdminLoginResponse>("/api/admin/login", {
        method: "POST",
        body: { password },
      }),

    logout: () => request<{ success: boolean }>("/api/admin/logout", { method: "POST" }),

    getPhotos: (filters: PhotoFilterInput) => {
      const params = new URLSearchParams()
      params.set("status", filters.status)
      params.set("page", String(filters.page))
      params.set("limit", String(filters.limit))
      if (filters.sessionId) params.set("sessionId", filters.sessionId)
      return request<PaginatedPhotos>(`/api/admin/photos?${params.toString()}`)
    },

    updatePhoto: (id: string, body: { status: string; rejectionReason?: string }) =>
      request<UpdatePhotoResponse>(`/api/admin/photos/${id}`, {
        method: "PATCH",
        body,
      }),

    bulkAction: (body: BulkPhotoActionInput) =>
      request<BulkActionResponse>("/api/admin/photos/bulk", {
        method: "POST",
        body,
      }),

    getSettings: () => request<AdminSettings>("/api/admin/settings"),

    updateSettings: (patch: UpdateSettingsInput) =>
      request<AdminSettings>("/api/admin/settings", {
        method: "PATCH",
        body: patch,
      }),

    resolveLocation: (url: string) =>
      request<{ lat: number | null; lng: number | null }>("/api/admin/resolve-location", {
        method: "POST",
        body: { url },
      }),

    deletePhoto: (id: string) =>
      request<DeletePhotoResponse>(`/api/admin/photos/${id}`, { method: "DELETE" }),

    getStats: () => request<DashboardResponse>("/api/admin/stats"),

    getUploaders: (page = 1) => request<PaginatedUploaders>(`/api/admin/uploaders?page=${page}`),

    getAnalytics: (filters: AnalyticsFilterInput) => {
      const params = new URLSearchParams()
      params.set("page", String(filters.page))
      params.set("limit", String(filters.limit))
      if (filters.from !== undefined) params.set("from", String(filters.from))
      if (filters.to !== undefined) params.set("to", String(filters.to))
      if (filters.eventType) params.set("eventType", filters.eventType)
      return request<AnalyticsResponse>(`/api/admin/analytics?${params.toString()}`)
    },
  },
}
