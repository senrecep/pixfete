"use client"

import { ProgressBar } from "@/components/ui/ProgressBar"
import { Spinner } from "@/components/ui/Spinner"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export type UploadItemStatus = "pending" | "uploading" | "done" | "error"

export interface UploadItem {
  id: string
  fileName: string
  progress: number
  status: UploadItemStatus
  error?: string
}

export function UploadProgress({ item }: { item: UploadItem }) {
  return (
    <div className="rounded-xl border border-accent-soft bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        {item.status === "done" ? (
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
        ) : item.status === "error" ? (
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
        ) : item.status === "uploading" ? (
          <Spinner className="h-4 w-4 flex-shrink-0" />
        ) : (
          <div className="h-4 w-4 flex-shrink-0 rounded-full border border-accent-light/50" />
        )}
        <p className="min-w-0 flex-1 truncate text-sm text-ink">{item.fileName}</p>
        <span className="text-xs text-ink/50">{Math.round(item.progress)}%</span>
      </div>
      <ProgressBar value={item.progress} />
      {item.error ? <p className="mt-1.5 text-xs text-red-500">{item.error}</p> : null}
    </div>
  )
}
