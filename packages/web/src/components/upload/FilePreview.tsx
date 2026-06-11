"use client"

import { interp } from "@/lib/i18n"
import { formatBytes } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { X } from "lucide-react"
import { useEffect, useState } from "react"

interface FilePreviewProps {
  file: File
  onRemove: () => void
  error?: string | undefined
}

export function FilePreview({ file, onRemove, error }: FilePreviewProps) {
  const { t } = useI18n()
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setThumb(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent-soft bg-white p-3">
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-accent-soft">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={file.name} className="h-full w-full object-cover" />
        ) : null}
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
