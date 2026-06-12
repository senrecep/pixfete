"use client"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { StatsCard } from "@/components/admin/StatsCard"
import { Badge } from "@/components/ui/Badge"
import { MediaThumb } from "@/components/ui/MediaThumb"
import { useApiError } from "@/hooks/useApiError"
import { api } from "@/lib/api"
import { photoSrc } from "@/lib/photo"
import type { DashboardResponse, Photo } from "@/lib/types"
import { formatBytes } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { format } from "date-fns"
import {
  CheckCircle2,
  Clock,
  HardDrive,
  ImageOff,
  Images,
  MessageSquareText,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export default function DashboardPage() {
  const { t } = useI18n()
  const { getErrorMessage } = useApiError()

  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.admin.getStats()
      setData(res)
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.dashboard.loadError)
    } finally {
      setLoading(false)
    }
  }, [getErrorMessage, t.admin.dashboard.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const quickAction = async (photo: Photo, status: "approved" | "rejected") => {
    setBusyId(photo.id)
    try {
      await api.admin.updatePhoto(photo.id, { status })
      toast.success(
        status === "approved" ? t.admin.dashboard.quickApproved : t.admin.dashboard.quickRejected,
      )
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.dashboard.actionError)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminLayout>
      <h1 className="font-display text-4xl text-accent-dark">{t.admin.dashboard.title}</h1>
      <p className="mt-1 text-sm text-ink/50">{t.admin.dashboard.subtitle}</p>

      {loading || !data ? (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => `dash-skel-${i}`).map((key) => (
            <div key={key} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard
              label={t.admin.dashboard.stats.total}
              value={data.stats.totalPhotos}
              icon={Images}
              accent="purple"
            />
            <StatsCard
              label={t.admin.dashboard.stats.pending}
              value={data.stats.pendingPhotos}
              icon={Clock}
              accent="amber"
            />
            <StatsCard
              label={t.admin.dashboard.stats.approved}
              value={data.stats.approvedPhotos}
              icon={CheckCircle2}
              accent="green"
            />
            <StatsCard
              label={t.admin.dashboard.stats.rejected}
              value={data.stats.rejectedPhotos}
              icon={XCircle}
              accent="red"
            />
            <StatsCard
              label={t.admin.dashboard.stats.uploaders}
              value={data.stats.totalUploaders}
              icon={Users}
              accent="blue"
            />
            <StatsCard
              label={t.admin.dashboard.stats.storage}
              value={formatBytes(data.stats.totalStorageBytes)}
              icon={HardDrive}
              accent="purple"
            />
            <StatsCard
              label={t.admin.dashboard.stats.today}
              value={data.stats.uploadsToday}
              icon={TrendingUp}
              accent="green"
            />
            <StatsCard
              label={t.admin.dashboard.stats.thisWeek}
              value={data.stats.uploadsThisWeek}
              icon={TrendingUp}
              accent="blue"
            />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
              <h2 className="font-display text-2xl text-ink">{t.admin.dashboard.recentUploads}</h2>
              {data.recentUploads.length === 0 ? (
                <p className="mt-4 text-sm text-ink/40">{t.admin.dashboard.noUploads}</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {data.recentUploads.map((photo) => (
                    <li
                      key={photo.id}
                      className="flex items-center gap-3 rounded-xl border border-accent-soft p-2.5"
                    >
                      <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft">
                        {(() => {
                          const src = photoSrc(photo)
                          if (!src) return <ImageOff className="h-5 w-5 text-accent/40" />
                          return (
                            <MediaThumb
                              src={src}
                              photo={photo}
                              alt={photo.fileName}
                              badge="sm"
                              compact
                            />
                          )
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {photo.uploaderName}
                        </p>
                        <p className="text-xs text-ink/40">
                          {format(photo.uploadedAt, "dd.MM HH:mm")}
                        </p>
                        {photo.uploaderNote ? (
                          <p className="mt-0.5 flex items-start gap-1 text-xs text-ink/60">
                            <MessageSquareText className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
                            <span className="line-clamp-2">{photo.uploaderNote}</span>
                          </p>
                        ) : null}
                      </div>
                      {photo.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === photo.id}
                            onClick={() => quickAction(photo, "approved")}
                            className="rounded-lg bg-green-100 p-1.5 text-green-600 transition-colors hover:bg-green-200 disabled:opacity-40"
                            aria-label={t.admin.dashboard.approveLabel}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === photo.id}
                            onClick={() => quickAction(photo, "rejected")}
                            className="rounded-lg bg-red-100 p-1.5 text-red-500 transition-colors hover:bg-red-200 disabled:opacity-40"
                            aria-label={t.admin.dashboard.rejectLabel}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Badge status={photo.status} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
              <h2 className="font-display text-2xl text-ink">{t.admin.dashboard.recentEvents}</h2>
              {data.recentEvents.length === 0 ? (
                <p className="mt-4 text-sm text-ink/40">{t.admin.dashboard.noEvents}</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {data.recentEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between rounded-xl border border-accent-soft px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-accent-dark">{event.eventType}</span>
                      <span className="text-xs text-ink/40">
                        {format(event.createdAt, "dd.MM HH:mm")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
