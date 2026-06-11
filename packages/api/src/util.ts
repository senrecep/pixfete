import { nanoid } from "nanoid"

/** Short, url-safe id for stored objects (used as the photo filename). */
export function generatePhotoId(): string {
  return nanoid(12)
}

/**
 * Short, url-safe viewer token for the shareable `/my/<token>` link. 20 chars of
 * nanoid is ~119 bits of entropy — far beyond guessable while staying compact.
 */
export function generateViewerToken(): string {
  return nanoid(20)
}

/** Extracts the best-effort client IP from request headers / connection. */
export function clientIp(headers: Record<string, string | undefined>, fallback?: string): string {
  const forwarded = headers["x-forwarded-for"]
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = headers["x-real-ip"]
  if (realIp) return realIp
  return fallback ?? "unknown"
}

export function userAgent(headers: Record<string, string | undefined>): string {
  return headers["user-agent"] ?? "unknown"
}
