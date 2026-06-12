"use client"

import { isVideo, mediaFormatLabel } from "@/lib/photo"
import type { Photo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { Play } from "lucide-react"
import { useState } from "react"
import { MediaFallback } from "./MediaFallback"

interface MediaThumbProps {
  /** Absolute media URL (already resolved via photoSrc, incl. viewer token). */
  src: string
  photo: Photo
  alt: string
  /** Extra classes for the media element (e.g. hover scale). */
  mediaClassName?: string
  /** Centered play badge size for videos. */
  badge?: "sm" | "md"
  /** Fallback message when the browser can't decode the file. */
  fallbackLabel?: string
  /** Icon-only fallback for tiny thumbnails where text wouldn't fit. */
  compact?: boolean
}

/**
 * Renders a photo or video thumbnail that lives inside a `relative`, sized
 * parent. On decode failure (HEIC outside Safari, HEVC, etc.) it swaps to a
 * MediaFallback so the user sees an informative placeholder instead of a broken
 * image — the file is still uploaded and stored, just not previewable here.
 */
export function MediaThumb({
  src,
  photo,
  alt,
  mediaClassName,
  badge = "md",
  fallbackLabel,
  compact,
}: MediaThumbProps) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const video = isVideo(photo)

  if (failed) {
    return (
      <MediaFallback
        label={fallbackLabel ?? t.media.unavailable}
        format={mediaFormatLabel(photo.fileName, photo.mimeType)}
        compact={compact}
      />
    )
  }

  const mediaClasses = cn(
    "h-full w-full object-cover transition-opacity duration-500",
    loaded ? "opacity-100" : "opacity-0",
    mediaClassName,
  )

  return (
    <>
      {loaded ? null : <div className="skeleton absolute inset-0" />}
      {video ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={mediaClasses}
        >
          <track kind="captions" />
        </video>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={mediaClasses}
        />
      )}
      {video ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-ink/45 backdrop-blur-sm",
              compact ? "h-6 w-6" : badge === "sm" ? "h-10 w-10" : "h-12 w-12",
            )}
          >
            <Play
              className={cn(
                "fill-white text-white",
                compact ? "h-3 w-3" : badge === "sm" ? "h-4 w-4" : "h-5 w-5",
              )}
            />
          </span>
        </div>
      ) : null}
    </>
  )
}
