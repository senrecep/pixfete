import type { Photo } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

/**
 * Resolves a displayable absolute image URL for a photo, or `null` when none is
 * available yet — callers MUST render a placeholder instead of `<img src="">`,
 * which makes the browser re-request the current document in a loop.
 *
 * Resolution rules:
 * - `publicUrl` set to an absolute URL (R2 / GDrive public) → use as-is.
 * - Local storage → serve via the API origin (`/api/uploads/<key>`). This works
 *   for approved photos (public) and, with a viewer token or admin cookie, for
 *   pending/rejected ones via the authenticated serve endpoint.
 * - Non-local without a public URL (pending R2/GDrive) → not viewable → `null`.
 *
 * @param viewerToken Owner's viewer token, appended for previewing own pending
 *   photos on the `/my/[token]` page. Admins are authorized via their cookie.
 */
export function photoSrc(photo: Photo, viewerToken?: string): string | null {
  if (photo.publicUrl && !photo.publicUrl.startsWith("/")) {
    return photo.publicUrl
  }

  // Local and GDrive both stream through the authenticated API proxy
  // (`/api/uploads/<key>`) — works for approved photos and, with a viewer token
  // or admin cookie, for pending/rejected ones. GDrive files are private (Shared
  // Drive), so they are never publicly reachable and must use this path.
  if (photo.storageType === "local" || photo.storageType === "gdrive") {
    const path =
      photo.publicUrl && photo.publicUrl.startsWith("/")
        ? photo.publicUrl
        : `/api/uploads/${photo.storageKey}`
    const url = `${API_URL}${path}`
    return viewerToken ? `${url}?token=${encodeURIComponent(viewerToken)}` : url
  }

  return photo.publicUrl ? `${API_URL}${photo.publicUrl}` : null
}
