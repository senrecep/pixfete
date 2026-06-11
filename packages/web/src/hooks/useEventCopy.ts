"use client"

import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"

/**
 * Resolves the event-type-specific copy: preset strings for the selected event
 * type (falling back to "generic"), with admin overrides applied where set.
 *
 * Lives outside EventProvider so the provider no longer imports I18nProvider —
 * I18nProvider already imports EventProvider (for the locale), and having both
 * import each other formed a circular dependency.
 */
export function useEventCopy() {
  const { t } = useI18n()
  const { event } = useEvent()
  const base = t.eventTypes[event.type] ?? t.eventTypes.generic
  return {
    ...base,
    welcome: event.overrides.welcome || base.welcome,
    galleryTitle: event.overrides.galleryTitle || base.galleryTitle,
  }
}
