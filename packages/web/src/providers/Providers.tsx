"use client"

import type { ReactNode } from "react"
import { EventProvider } from "./EventProvider"
import { I18nProvider } from "./I18nProvider"

export function Providers({ children }: { children: ReactNode }) {
  // EventProvider wraps I18nProvider: it fetches the admin-selected locale and
  // I18nProvider reads it. Both contexts are then available to all children.
  return (
    <EventProvider>
      <I18nProvider>{children}</I18nProvider>
    </EventProvider>
  )
}
