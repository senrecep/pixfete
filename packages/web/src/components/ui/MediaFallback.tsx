"use client"

import { cn } from "@/lib/utils"
import { FileQuestion } from "lucide-react"

interface MediaFallbackProps {
  /** Human-readable explanation, e.g. "can't preview in this browser". */
  label: string
  /** Short format badge (HEIC, MOV, …). Hidden in compact mode. */
  format?: string | undefined
  /** Icon-only rendering for tiny thumbnails where text wouldn't fit. */
  compact?: boolean | undefined
}

/**
 * Shown in place of an `<img>`/`<video>` that the browser can't decode (e.g.
 * HEIC photos or HEVC videos outside Safari). The bytes are uploaded and stored
 * fine — this only signals that THIS browser can't render a preview, so the
 * user isn't left staring at a broken-image icon.
 */
export function MediaFallback({ label, format, compact }: MediaFallbackProps) {
  return (
    <div
      title={compact ? label : undefined}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-accent-soft text-center text-ink/60",
        compact ? "p-1" : "p-4",
      )}
    >
      <FileQuestion className={cn("text-accent/50", compact ? "h-5 w-5" : "h-8 w-8")} />
      {compact ? null : <p className="text-xs leading-snug">{label}</p>}
      {compact || !format ? null : (
        <span className="rounded-full bg-white/70 px-2 py-0.5 font-medium text-[0.65rem] text-accent-dark tracking-wide">
          {format}
        </span>
      )}
    </div>
  )
}
