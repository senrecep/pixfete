"use client"

import { googleDirectionsHref } from "@/lib/maps"
import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"
import { Heart, MapPin } from "lucide-react"

export function Footer() {
  const { t } = useI18n()
  const { event } = useEvent()
  const mapsHref = googleDirectionsHref(event)

  return (
    <footer className="border-t border-accent-soft/80 bg-accent-soft/40">
      <div className="mx-auto max-w-6xl px-5 py-12 text-center">
        <p className="font-display text-3xl text-accent-dark">{event.title}</p>
        <p className="mt-2 text-sm tracking-widest text-ink/60 uppercase">
          {t.home.eventDate} · {t.home.eventDay}
        </p>
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-dark"
        >
          <MapPin className="h-4 w-4" />
          {event.venueName}, {event.venueAddress}
        </a>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink/40">
          {t.footer.madeWith} <Heart className="h-3 w-3 fill-accent-light text-accent-light" />
        </p>
      </div>
    </footer>
  )
}
