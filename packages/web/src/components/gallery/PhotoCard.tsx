"use client"

import { MediaThumb } from "@/components/ui/MediaThumb"
import { useEventCopy } from "@/hooks/useEventCopy"
import { interp } from "@/lib/i18n"
import { photoSrc } from "@/lib/photo"
import type { Photo } from "@/lib/types"
import { useI18n } from "@/providers/I18nProvider"
import { motion } from "framer-motion"
import { ImageOff } from "lucide-react"

interface PhotoCardProps {
  photo: Photo
  onClick: () => void
  priority?: boolean
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const { t } = useI18n()
  const copy = useEventCopy()
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 0.75
  const src = photoSrc(photo)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="group relative block w-full overflow-hidden rounded-2xl bg-accent-soft text-left shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      aria-label={interp(t.gallery.expandPhoto, { name: photo.uploaderName })}
    >
      <div className="relative w-full" style={{ aspectRatio: String(aspectRatio) }}>
        {src ? (
          <MediaThumb
            src={src}
            photo={photo}
            alt={interp(copy.photoAlt, { name: photo.uploaderName })}
            mediaClassName="group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-accent/40" />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <p className="font-display text-lg text-white drop-shadow">{photo.uploaderName}</p>
        {photo.width && photo.height ? (
          <p className="text-xs text-white/70">
            {photo.width} × {photo.height}
          </p>
        ) : null}
      </div>
    </motion.button>
  )
}
