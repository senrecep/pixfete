"use client"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { StatsCard } from "@/components/admin/StatsCard"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ApiClientError, api } from "@/lib/api"
import { interp } from "@/lib/i18n"
import type { AnalyticsResponse, PaginatedUploaders } from "@/lib/types"
import { formatBytes } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { format } from "date-fns"
import { Activity, ChevronLeft, ChevronRight, Network, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const EVENTS_PAGE_SIZE = 25

function toEpoch(value: string): number | undefined {
  if (!value) return undefined
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? undefined : t
}

export default function AnalyticsPage() {
  const { t } = useI18n()
  const a = t.admin.analytics
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [uploaders, setUploaders] = useState<PaginatedUploaders | null>(null)
  const [loading, setLoading] = useState(true)

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [eventType, setEventType] = useState("")
  const [eventsPage, setEventsPage] = useState(1)

  const load = useCallback(
    async (filters: { from: string; to: string; eventType: string; eventsPage: number }) => {
      setLoading(true)
      try {
        const fromEpoch = toEpoch(filters.from)
        const toEpochValue = toEpoch(filters.to)
        const [analyticsRes, uploadersRes] = await Promise.all([
          api.admin.getAnalytics({
            page: filters.eventsPage,
            limit: EVENTS_PAGE_SIZE,
            ...(fromEpoch !== undefined ? { from: fromEpoch } : {}),
            ...(toEpochValue !== undefined ? { to: toEpochValue } : {}),
            ...(filters.eventType ? { eventType: filters.eventType } : {}),
          }),
          api.admin.getUploaders(1),
        ])
        setAnalytics(analyticsRes)
        setUploaders(uploadersRes)
      } catch (err) {
        const message = err instanceof ApiClientError ? err.message : a.loadError
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [a.loadError],
  )

  useEffect(() => {
    void load({ from: "", to: "", eventType: "", eventsPage: 1 })
  }, [load])

  const maxDayCount = useMemo(() => {
    if (!analytics || analytics.uploadsByDay.length === 0) return 1
    return Math.max(...analytics.uploadsByDay.map((d) => d.count), 1)
  }, [analytics])

  return (
    <AdminLayout>
      <h1 className="font-display text-4xl text-accent-dark">{a.title}</h1>
      <p className="mt-1 text-sm text-ink/50">{a.subtitle}</p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-accent-soft bg-white p-4">
        <div className="w-40">
          <Input
            type="date"
            label={a.filterFrom}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Input
            type="date"
            label={a.filterTo}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Input
            label={a.filterEventType}
            placeholder={a.filterEventTypePlaceholder}
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setEventsPage(1)
            void load({ from, to, eventType, eventsPage: 1 })
          }}
          loading={loading}
        >
          {a.filterBtn}
        </Button>
      </div>

      {loading || !analytics || !uploaders ? (
        <div className="mt-8 grid gap-4">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard
              label={a.totalEvents}
              value={analytics.totalEvents}
              icon={Activity}
              accent="purple"
            />
            <StatsCard
              label={a.uniqueIps}
              value={analytics.uniqueIps}
              icon={Network}
              accent="blue"
            />
            <StatsCard label={a.uploaders} value={uploaders.total} icon={Users} accent="green" />
          </div>

          <section className="mt-8 rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-ink">{a.dailyUploads}</h2>
              <span className="text-xs text-ink/40">
                {interp(a.daysPeak, {
                  days: analytics.uploadsByDay.length,
                  peak: maxDayCount,
                })}
              </span>
            </div>
            {analytics.uploadsByDay.length === 0 ? (
              <div className="mt-6 flex h-40 items-center justify-center rounded-xl bg-accent-soft/20 text-sm text-ink/40">
                {a.noData}
              </div>
            ) : (
              // Fixed-width bars (left-aligned, scroll when many) so a single
              // day renders as a real bar instead of stretching full width.
              <div className="mt-6 flex h-56 gap-4 overflow-x-auto border-b border-accent-soft/70 pt-6 pb-px">
                {analytics.uploadsByDay.map((day) => {
                  const pct = Math.max(Math.round((day.count / maxDayCount) * 100), 3)
                  return (
                    <div key={day.date} className="flex w-12 shrink-0 flex-col items-center">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="group relative w-full rounded-t-md bg-accent/85 transition-colors duration-200 hover:bg-accent"
                          style={{ height: `${pct}%` }}
                        >
                          <span className="-top-5 -translate-x-1/2 absolute left-1/2 font-medium text-ink/60 text-xs tabular-nums">
                            {day.count}
                          </span>
                        </div>
                      </div>
                      <span className="mt-2 whitespace-nowrap text-[0.65rem] text-ink/40 tabular-nums">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
            <h2 className="font-display text-2xl text-ink">{a.uploadersTitle}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-accent-soft text-xs tracking-wide text-ink/40 uppercase">
                    <th className="py-2 pr-4">{a.colName}</th>
                    <th className="py-2 pr-4">{a.colPhone}</th>
                    <th className="py-2 pr-4">{a.colNote}</th>
                    <th className="py-2 pr-4">{a.colPhotos}</th>
                    <th className="py-2 pr-4">{a.colStorage}</th>
                    <th className="py-2 pr-4">{a.colFirst}</th>
                    <th className="py-2">{a.colLast}</th>
                  </tr>
                </thead>
                <tbody>
                  {uploaders.uploaders.map((u) => (
                    <tr key={u.sessionId} className="border-b border-accent-soft/60">
                      <td className="py-2.5 pr-4 font-medium text-ink">{u.uploaderName}</td>
                      <td className="py-2.5 pr-4 text-ink/60">{u.uploaderPhone ?? "—"}</td>
                      <td className="max-w-[16rem] py-2.5 pr-4 text-ink/60">
                        {u.uploaderNote ? (
                          <span className="block truncate" title={u.uploaderNote}>
                            {u.uploaderNote}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-ink/60">
                        {u.photoCount} ({interp(a.approvedShort, { count: u.approvedCount })})
                      </td>
                      <td className="py-2.5 pr-4 text-ink/60">{formatBytes(u.totalSizeBytes)}</td>
                      <td className="py-2.5 pr-4 text-ink/50">
                        {format(u.firstUploadAt, "dd.MM.yy")}
                      </td>
                      <td className="py-2.5 text-ink/50">{format(u.lastUploadAt, "dd.MM.yy")}</td>
                    </tr>
                  ))}
                  {uploaders.uploaders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-ink/40">
                        {a.noUploaders}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
            <h2 className="font-display text-2xl text-ink">{a.recentEvents}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-accent-soft text-xs tracking-wide text-ink/40 uppercase">
                    <th className="py-2 pr-4">{a.colEvent}</th>
                    <th className="py-2 pr-4">{a.colIp}</th>
                    <th className="py-2">{a.colTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.events.map((event) => (
                    <tr key={event.id} className="border-b border-accent-soft/60">
                      <td className="py-2.5 pr-4 font-medium text-accent-dark">
                        {event.eventType}
                      </td>
                      <td className="py-2.5 pr-4 text-ink/50">{event.ipAddress}</td>
                      <td className="py-2.5 text-ink/50">
                        {format(event.createdAt, "dd.MM.yyyy HH:mm:ss")}
                      </td>
                    </tr>
                  ))}
                  {analytics.events.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-ink/40">
                        {a.noEvents}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {(() => {
              const totalPages = Math.ceil(analytics.total / EVENTS_PAGE_SIZE)
              if (totalPages <= 1) return null
              return (
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={eventsPage <= 1 || loading}
                    onClick={() => {
                      const p = eventsPage - 1
                      setEventsPage(p)
                      void load({ from, to, eventType, eventsPage: p })
                    }}
                    className="flex min-h-11 items-center gap-1 rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm text-accent-dark disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {a.prev}
                  </button>
                  <span className="text-sm text-ink/50">
                    {interp(a.eventsPage, { page: eventsPage, total: totalPages })}
                  </span>
                  <button
                    type="button"
                    disabled={eventsPage >= totalPages || loading}
                    onClick={() => {
                      const p = eventsPage + 1
                      setEventsPage(p)
                      void load({ from, to, eventType, eventsPage: p })
                    }}
                    className="flex min-h-11 items-center gap-1 rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm text-accent-dark disabled:opacity-40"
                  >
                    {a.next}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )
            })()}
          </section>
        </>
      )}
    </AdminLayout>
  )
}
