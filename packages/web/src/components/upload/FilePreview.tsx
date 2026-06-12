"use client"

import { MediaFallback } from "@/components/ui/MediaFallback"
import { interp } from "@/lib/i18n"
import { mediaFormatLabel } from "@/lib/photo"
import { formatBytes } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { Play, X } from "lucide-react"
import { useEffect, useState } from "react"

interface FilePreviewProps {
  file: File
  onRemove: () => void
  error?: string | undefined
}

export function FilePreview({ file, onRemove, error }: FilePreviewProps) {
  const { t } = useI18n()
  const [thumb, setThumb] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setThumb(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const isVideo = file.type.startsWith("video/")

  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent-soft bg-white p-3">
      <div
        aria-hidden="true"
        className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-accent-soft"
      >
        {!thumb ? null : failed ? (
          <MediaFallback
            compact
            label={t.media.unavailableLocal}
            format={mediaFormatLabel(file.name, file.type)}
          />
        ) : isVideo ? (
          <>
            <video
              src={thumb}
              muted
              playsInline
              aria-hidden="true"
              tabIndex={-1}
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            >
              <track kind="captions" />
            </video>
            <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
              <Play className="h-5 w-5 fill-white text-white drop-shadow" />
            </div>
          </>
        ) : (
          <img
            src={thumb}
            alt={file.name}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{file.name}</p>
        <p className="text-xs text-ink/50">{formatBytes(file.size)}</p>
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={interp(t.filePreview.removeLabel, { name: file.name })}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
