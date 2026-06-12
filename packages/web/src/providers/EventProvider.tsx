"use client"

import { api } from "@/lib/api"
import { DEFAULT_EVENT } from "@/lib/event"
import type { Locale } from "@/lib/i18n"
import { applyAccent } from "@/lib/theme"
import type { EventConfig, FeatureFlags, PublicUploadLimits } from "@/lib/types"
import { type ReactNode, createContext, use, useEffect, useState } from "react"

const DEFAULT_FEATURES: FeatureFlags = { phoneField: true, noteField: true }
const DEFAULT_UPLOAD: PublicUploadLimits = { maxFileSizeMb: 1024, maxFilesPerSession: 30 }

interface EventContextValue {
  event: EventConfig
  features: FeatureFlags
  /** Admin-managed upload limits, used to validate selected files client-side. */
  upload: PublicUploadLimits
  /** UI language, fixed by the admin. English until the API responds. */
  locale: Locale
}

// Defaults render immediately (SSR / pre-fetch); real values arrive from
// /api/event (admin-managed) once the provider mounts.
const EventContext = createContext<EventContextValue>({
  event: DEFAULT_EVENT,
  features: DEFAULT_FEATURES,
  upload: DEFAULT_UPLOAD,
  locale: "en",
})

export function EventProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<EventContextValue>({
    event: DEFAULT_EVENT,
    features: DEFAULT_FEATURES,
    upload: DEFAULT_UPLOAD,
    locale: "en",
  })

  useEffect(() => {
    let active = true
    api.event
      .getInfo()
      .then((res) => {
        if (active)
          setValue({
            event: res.event,
            features: res.features,
            upload: res.upload,
            locale: res.locale,
          })
      })
      .catch(() => {
        // Keep defaults if the API is unreachable.
      })
    return () => {
      active = false
    }
  }, [])

  // Apply the accent palette to the document root.
  useEffect(() => {
    applyAccent(value.event.accentColor)
  }, [value.event.accentColor])

  // Use the event title as the page (browser tab) title.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = value.event.title || "Pixfete"
    }
  }, [value.event.title])

  // Reflect the admin-selected locale on <html lang> so CSS text-transform
  // (uppercase) and the browser case content with the correct language rules
  // — otherwise English text under a stale lang="tr" uppercases "i" → "İ".
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = value.locale
    }
  }, [value.locale])

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export function useEvent(): EventContextValue {
  return use(EventContext)
}
