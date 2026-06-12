"use client"

import { useEffect } from "react"

/**
 * Holds a screen Wake Lock while `active` is true so the device doesn't dim,
 * sleep, or lock during long uploads (large videos can take minutes on mobile).
 *
 * - No-op where the API is unsupported (older Safari/Firefox) — the upload
 *   still proceeds, the screen just isn't kept awake.
 * - The browser drops the lock whenever the tab is hidden, so it is re-acquired
 *   on `visibilitychange` when the tab returns to the foreground.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return
    }

    let sentinel: WakeLockSentinel | null = null
    // Guards against the async request resolving after the effect has cleaned up.
    let cancelled = false
    // Prevents overlapping requests from leaking a sentinel when the tab becomes
    // visible again before a previous request has resolved.
    let acquiring = false

    const acquire = () => {
      if (sentinel !== null || acquiring) return
      acquiring = true
      navigator.wakeLock
        .request("screen")
        .then((next) => {
          acquiring = false
          if (cancelled) {
            void next.release()
            return
          }
          sentinel = next
          // The browser auto-releases on hide; clear our ref so the next
          // foreground visit re-acquires instead of thinking it still holds one.
          next.addEventListener("release", () => {
            if (sentinel === next) sentinel = null
          })
        })
        .catch(() => {
          // Rejected (e.g. low battery, not user-active) — safe to ignore.
          acquiring = false
        })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire()
    }

    acquire()
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (sentinel) void sentinel.release()
    }
  }, [active])
}
