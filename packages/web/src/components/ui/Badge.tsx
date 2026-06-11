"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import type { PhotoStatus } from "@pixfete/shared"

const statusClasses: Record<PhotoStatus, string> = {
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  approved: "bg-green-100 text-green-700 border border-green-200",
  rejected: "bg-red-100 text-red-600 border border-red-200",
}

export function Badge({
  status,
  className,
}: {
  status: PhotoStatus
  className?: string
}) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusClasses[status],
        className,
      )}
    >
      {t.status[status]}
    </span>
  )
}
