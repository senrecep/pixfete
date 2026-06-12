"use client"

import { interp } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { ImagePlus } from "lucide-react"
import { useCallback, useId, useState } from "react"

interface DropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  remaining: number
}

export function DropZone({ onFiles, disabled, remaining }: DropZoneProps) {
  const { t } = useI18n()
  const [dragging, setDragging] = useState(false)
  const inputId = useId()

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      onFiles(Array.from(fileList))
    },
    [onFiles],
  )

  // The whole zone is a <label> tied to the hidden file input, so tapping
  // anywhere (not just the button) opens the picker — essential on touch
  // devices where drag-and-drop isn't available.
  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        dragging ? "border-accent bg-accent-soft" : "border-accent-light/50 bg-white",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
        <ImagePlus className="h-8 w-8 text-accent" />
      </div>
      <p className="font-display text-2xl text-ink">{t.upload.select.dropTitle}</p>
      <p className="mt-1 text-sm text-ink/50">{interp(t.upload.select.dropSub, { remaining })}</p>
      <span className="mt-5 inline-flex min-h-11 items-center rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors">
        {t.upload.select.selectBtn}
      </span>
      <input
        id={inputId}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </label>
  )
}
