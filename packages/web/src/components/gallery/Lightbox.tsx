"use client"

import { MediaFallback } from "@/components/ui/MediaFallback"
import { useEventCopy } from "@/hooks/useEventCopy"
import { interp } from "@/lib/i18n"
import { isVideo, mediaFormatLabel, photoSrc } from "@/lib/photo"
import type { Photo } from "@/lib/types"
import { useI18n } from "@/providers/I18nProvider"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface LightboxProps {
  photos: Photo[]
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
  /** Owner viewer token — appended so pending/rejected photos load via the
   *  authenticated proxy (used by the "my photos" page). */
  viewerToken?: string
}

export function Lightbox({ photos, index, onClose, onNavigate, viewerToken }: LightboxProps) {
  const { t } = useI18n()
  const copy = useEventCopy()
  const open = index !== null
  const current = open ? photos[index] : undefined

  const touchStartX = useRef<number | null>(null)

  const goPrev = useCallback(() => {
    if (index === null) return
    onNavigate((index - 1 + photos.length) % photos.length)
  }, [index, photos.length, onNavigate])

  const goNext = useCallback(() => {
    if (index === null) return
    onNavigate((index + 1) % photos.length)
  }, [index, photos.length, onNavigate])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose, goPrev, goNext])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || photos.length <= 1) return
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext()
      else goPrev()
    }
    touchStartX.current = null
  }

  return (
    <AnimatePresence>
      {open && current ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          // biome-ignore lint/a11y/useSemanticElements: animated overlay requires a motion.div, not a native <dialog>
          role="dialog"
          aria-modal="true"
          aria-label={t.gallery.lightbox.label}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t.gallery.lightbox.close}
            className="absolute top-[calc(env(safe-area-inset-top,0px)+1.25rem)] right-5 z-10 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </button>

          {photos.length > 1 ? (
            <button
              type="button"
              onClick={goPrev}
              aria-label={t.gallery.lightbox.prev}
              className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 sm:left-6"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          ) : null}

          <motion.div
            key={current.id}
            className="flex max-h-[88dvh] max-w-[92vw] flex-col items-center"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <LightboxMedia
              key={current.id}
              photo={current}
              src={photoSrc(current, viewerToken) ?? undefined}
              alt={interp(copy.photoAlt, { name: current.uploaderName })}
            />
            <p className="mt-4 font-display text-xl text-white/90">{current.uploaderName}</p>
          </motion.div>

          {photos.length > 1 ? (
            <button
              type="button"
              onClick={goNext}
              aria-label={t.gallery.lightbox.next}
              className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 sm:right-6"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * Full-size media for the lightbox. Kept as a child (keyed by photo id) so its
 * decode-failure state resets when the user navigates between items. Falls back
 * to a MediaFallback when the browser can't render the file (HEIC/HEVC, …).
 */
function LightboxMedia({
  photo,
  src,
  alt,
}: {
  photo: Photo
  src: string | undefined
  alt: string
}) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="flex h-[55dvh] w-[85vw] max-w-md items-center justify-center overflow-hidden rounded-lg">
        <MediaFallback
          label={t.media.unavailable}
          format={src ? mediaFormatLabel(photo.fileName, photo.mimeType) : undefined}
        />
      </div>
    )
  }

  return isVideo(photo) ? (
    <video
      src={src}
      controls
      autoPlay
      playsInline
      aria-label={alt}
      onError={() => setFailed(true)}
      className="max-h-[80dvh] max-w-full rounded-lg object-contain shadow-2xl"
    >
      <track kind="captions" />
    </video>
  ) : (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="max-h-[80dvh] max-w-full rounded-lg object-contain shadow-2xl"
    />
  )
}
