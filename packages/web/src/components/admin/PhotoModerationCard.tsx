"use client"

import { Badge } from "@/components/ui/Badge"
import { interp } from "@/lib/i18n"
import { photoSrc } from "@/lib/photo"
import type { Photo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { format } from "date-fns"
import { Check, ImageOff, Trash2, X } from "lucide-react"

interface PhotoModerationCardProps {
  photo: Photo
  selected: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onOpen?: () => void
  busy?: boolean
}

export function PhotoModerationCard({
  photo,
  selected,
  onToggleSelect,
  onApprove,
  onReject,
  onDelete,
  onOpen,
  busy,
}: PhotoModerationCardProps) {
  const src = photoSrc(photo)
  const { t } = useI18n()
  const c = t.admin.moderation.card
  return (
    <div
      className={cn(
        "@container overflow-hidden rounded-2xl border bg-white shadow-sm transition-all",
        selected ? "border-accent ring-2 ring-accent/30" : "border-accent-soft",
      )}
    >
      <div className="relative flex aspect-square items-center justify-center bg-accent-soft">
        {src ? (
          <button
            type="button"
            onClick={onOpen}
            className="h-full w-full cursor-zoom-in"
            aria-label={interp(c.expandPhoto, { name: photo.uploaderName })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={interp(c.photoAlt, { name: photo.uploaderName })}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <ImageOff className="h-8 w-8 text-accent/40" />
        )}
        <label className="absolute top-0 left-0 flex cursor-pointer items-center rounded-br-2xl rounded-tl-2xl bg-white/40 p-3 backdrop-blur-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-5 w-5 rounded border-white/60 bg-white/80 text-accent accent-accent"
            aria-label={interp(c.selectPhoto, { name: photo.uploaderName })}
          />
        </label>
        <div className="absolute top-2 right-2">
          <Badge status={photo.status} />
        </div>
      </div>

      <div className="p-3">
        <p className="truncate font-medium text-ink">{photo.uploaderName}</p>
        <p className="text-xs text-ink/50">
          {format(photo.uploadedAt, "dd.MM.yyyy HH:mm")} · {formatBytes(photo.originalSize)}
        </p>
        {photo.rejectionReason ? (
          <p className="mt-1 text-xs text-red-500">
            {interp(c.reason, { reason: photo.rejectionReason })}
          </p>
        ) : null}

        {/* Narrow cards (2-col mobile grid) stack the actions into two rows;
            wider cards lay them out in a single row via container query. */}
        <div className="mt-3 flex flex-col gap-1.5 @[12rem]:flex-row">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy || photo.status === "approved"}
            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-green-100 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-40"
            aria-label={c.approve}
          >
            <Check className="h-4 w-4" /> {c.approve}
          </button>
          <div className="flex flex-1 gap-1.5">
            <button
              type="button"
              onClick={onReject}
              disabled={busy || photo.status === "rejected"}
              className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-amber-100 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-200 disabled:opacity-40"
              aria-label={c.reject}
            >
              <X className="h-4 w-4" /> {c.reject}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-40"
              aria-label={c.delete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
