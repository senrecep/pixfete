"use client"

import { ApiClientError } from "@/lib/api"
import { useI18n } from "@/providers/I18nProvider"
import { useCallback } from "react"

/**
 * Returns a helper that turns any caught error into a locale-aware message.
 * Uses the API error code for lookup; falls back to "unknown".
 *
 * `getErrorMessage` is memoized so it stays referentially stable across renders
 * (only changing with the locale). Consumers use it in effect/callback deps, so
 * an unstable reference would otherwise cause infinite re-fetch loops.
 */
export function useApiError() {
  const { te } = useI18n()

  const getErrorMessage = useCallback(
    (err: unknown, params?: Record<string, string | number>): string => {
      if (err instanceof ApiClientError) {
        // Several error templates carry a `{max}` placeholder (file count, size
        // limit…). The server's English message embeds the authoritative number
        // ("Maximum 30 files per session"), so when the caller doesn't pass
        // params we lift that number out and interpolate it — otherwise the
        // user sees a literal "{max}".
        const resolved =
          params ??
          (() => {
            const n = err.message.match(/\d+/)?.[0]
            return n ? { max: Number(n) } : undefined
          })()
        return te(err.code, resolved)
      }
      return te("unknown")
    },
    [te],
  )

  return { getErrorMessage }
}
