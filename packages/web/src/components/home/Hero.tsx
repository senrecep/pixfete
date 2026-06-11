"use client"

import { Countdown } from "@/components/Countdown"
import { QrInline } from "@/components/QrInline"
import { useEventCopy } from "@/hooks/useEventCopy"
import { SITE_URL } from "@/lib/event"
import { coordsFromMapUrl, googleDirectionsHref } from "@/lib/maps"
import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"
import { motion } from "framer-motion"
import { Calendar, Camera, ImageIcon, MapPin } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-accent-soft" />,
})

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

export function Hero() {
  const { t } = useI18n()
  const { event } = useEvent()
  const copy = useEventCopy()

  // The couple's name is the title (e.g. "Melek & Recep"); split on "&" so the
  // ampersand keeps its accent styling. hostsLeft/hostsRight are the families.
  const [coupleLeft, ...coupleRest] = event.title.split(/\s*&\s*/)
  const coupleRight = coupleRest.join(" & ")
  const families = [event.hostsLeft, event.hostsRight].filter(Boolean)
  // Coordinates come from the picker; if absent, try to read them from the
  // venue maps URL (Google / OpenStreetMap link).
  const coords =
    event.lat != null && event.lng != null
      ? { lat: event.lat, lng: event.lng }
      : coordsFromMapUrl(event.venueMapsUrl)
  // Tapping the venue card opens Google Maps directions (origin = device
  // location), matching the in-map directions popup below.
  const mapsHref = googleDirectionsHref(event)

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-20 text-center">
      {/* Animated watercolor background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-soft via-cream to-cream" />
        <div className="animate-float-slow absolute -top-24 -left-24 h-96 w-96 rounded-full bg-accent-light/40 blur-3xl" />
        <div className="animate-float-slow absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl [animation-delay:-6s]" />
        <div className="animate-float-slow absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-accent-light/30 blur-3xl [animation-delay:-12s]" />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.18 }}
        className="flex flex-col items-center"
      >
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mb-4 text-sm tracking-[0.3em] text-accent uppercase"
        >
          {copy.welcome}
        </motion.p>

        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="font-display text-5xl leading-none font-medium break-words text-accent-dark sm:text-8xl"
        >
          {coupleRight ? (
            <>
              {coupleLeft}
              <span className="mx-3 text-accent-light">&amp;</span>
              {coupleRight}
            </>
          ) : (
            event.title
          )}
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="mt-5 font-display text-2xl text-ink/70 italic sm:text-3xl"
        >
          {event.subtitle}
        </motion.p>

        {families.length > 0 ? (
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="mt-4 text-sm tracking-wide text-ink/45"
          >
            {families.join("  ·  ")}
          </motion.p>
        ) : null}

        <motion.div variants={fadeUp} transition={{ duration: 0.7 }} className="mt-12">
          <Countdown />
        </motion.div>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="mt-12 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-medium text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent-dark hover:shadow-xl"
          >
            <Camera className="h-5 w-5" />
            {t.home.uploadBtn}
          </Link>
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-light/60 bg-white/70 px-8 py-4 text-base font-medium text-accent-dark backdrop-blur-sm transition-all hover:bg-white"
          >
            <ImageIcon className="h-5 w-5" />
            {t.home.galleryBtn}
          </Link>
        </motion.div>
      </motion.div>

      {/* Event details card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-16 grid w-full max-w-3xl gap-4 sm:grid-cols-2"
      >
        <div className="flex items-center gap-4 rounded-2xl border border-accent-soft bg-white/80 p-5 text-left backdrop-blur-sm">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft">
            <Calendar className="h-6 w-6 text-accent" />
          </span>
          <div>
            <p className="text-xs tracking-widest text-ink/40 uppercase">{t.home.dateLabel}</p>
            <p className="font-display text-xl text-ink">{t.home.eventDate}</p>
            <p className="text-sm text-ink/60">{t.home.eventDay}</p>
          </div>
        </div>
        <a
          href={mapsHref || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-accent-soft bg-white/80 p-5 text-left backdrop-blur-sm transition-colors hover:bg-white"
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft">
            <MapPin className="h-6 w-6 text-accent" />
          </span>
          <div>
            <p className="text-xs tracking-widest text-ink/40 uppercase">{t.home.venueLabel}</p>
            <p className="font-display text-xl text-ink">{event.venueName}</p>
            <p className="text-sm text-ink/60">{event.venueAddress}</p>
          </div>
        </a>
      </motion.div>

      {/* Location map */}
      {coords ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-6 w-full max-w-3xl"
        >
          <div className="h-80 w-full overflow-hidden rounded-2xl border border-accent-soft shadow-sm sm:h-[28rem]">
            <LeafletMap lat={coords.lat} lng={coords.lng} venueName={event.venueName} />
          </div>
        </motion.div>
      ) : null}

      {/* QR section */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-16 flex flex-col items-center"
      >
        <p className="mb-4 text-sm tracking-widest text-ink/50 uppercase">{t.home.shareLabel}</p>
        <div className="rounded-3xl border border-accent-soft bg-white p-5 shadow-sm">
          <QrInline value={SITE_URL} size={150} className="rounded-xl" />
        </div>
        {/* Download (PNG/PDF) is admin-only at /admin/qr — guests only scan here. */}
      </motion.div>
    </section>
  )
}
