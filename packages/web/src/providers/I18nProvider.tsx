"use client"

import { type Locale, type Strings, interp, locales } from "@/lib/i18n"
import { useEvent } from "@/providers/EventProvider"
import { type ReactNode, createContext, use, useCallback, useMemo } from "react"

interface I18nContextValue {
  locale: Locale
  t: Strings
  /** Looks up an API error code and interpolates optional params into the message. */
  te: (code: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // The locale is admin-controlled and arrives via EventProvider (which wraps
  // this provider). It is fixed for every guest — no client-side switching.
  const { locale } = useEvent()

  // `locales[locale]` is a module-level constant, so it is stable per locale.
  const current = locales[locale]

  // Memoized so consumers (e.g. useApiError, effect deps) get a stable reference
  // that only changes when the locale changes — prevents render loops.
  const te = useCallback(
    (code: string, params?: Record<string, string | number>): string => {
      const msg = current.errors[code] ?? current.errors.unknown ?? "Error"
      return params ? interp(msg, params) : msg
    },
    [current],
  )

  const value = useMemo(() => ({ locale, t: current.strings, te }), [locale, current, te])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = use(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider")
  return ctx
}
