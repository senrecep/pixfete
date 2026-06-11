"use client"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { PhotoModerationCard } from "@/components/admin/PhotoModerationCard"
import { Lightbox } from "@/components/gallery/Lightbox"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { useApiError } from "@/hooks/useApiError"
import { api } from "@/lib/api"
import { interp } from "@/lib/i18n"
import type { Photo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import type { PhotoStatus } from "@pixfete/shared"
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type FilterTab = PhotoStatus | "all"

const LIMIT = 24

export default function ModerationPage() {
  const { t } = useI18n()
  const { getErrorMessage } = useApiError()

  const tabs: Array<{ key: FilterTab; label: string }> = [
    { key: "all", label: t.admin.moderation.tabs.all },
    { key: "pending", label: t.admin.moderation.tabs.pending },
    { key: "approved", label: t.admin.moderation.tabs.approved },
    { key: "rejected", label: t.admin.moderation.tabs.rejected },
  ]

  const [tab, setTab] = useState<FilterTab>("pending")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const [rejectTarget, setRejectTarget] = useState<string | "bulk" | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.admin.getPhotos({ status: tab, page, limit: LIMIT })
      setPhotos(res.photos)
      setTotalPages(res.totalPages)
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.moderation.loadError)
    } finally {
      setLoading(false)
    }
  }, [tab, page, getErrorMessage, t.admin.moderation.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const allSelected = useMemo(
    () => photos.length > 0 && photos.every((p) => selected.has(p.id)),
    [photos, selected],
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(photos.map((p) => p.id)))
  const deselectAll = () => setSelected(new Set())

  const approve = async (id: string) => {
    setBusyId(id)
    try {
      await api.admin.updatePhoto(id, { status: "approved" })
      toast.success(t.admin.moderation.approvedMsg)
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.moderation.actionError)
    } finally {
      setBusyId(null)
    }
  }

  const confirmReject = async () => {
    const reason = rejectReason.trim()
    try {
      if (rejectTarget === "bulk") {
        setBulkBusy(true)
        await api.admin.bulkAction({
          photoIds: Array.from(selected),
          action: "reject",
          ...(reason ? { rejectionReason: reason } : {}),
        })
        toast.success(t.admin.moderation.bulkRejectedMsg)
        deselectAll()
      } else if (rejectTarget) {
        setBusyId(rejectTarget)
        await api.admin.updatePhoto(rejectTarget, {
          status: "rejected",
          ...(reason ? { rejectionReason: reason } : {}),
        })
        toast.success(t.admin.moderation.rejectedMsg)
      }
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.moderation.actionError)
    } finally {
      setBusyId(null)
      setBulkBusy(false)
      setRejectTarget(null)
      setRejectReason("")
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      await api.admin.deletePhoto(id)
      toast.success(t.admin.moderation.deletedMsg)
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.moderation.deleteError)
    } finally {
      setBusyId(null)
    }
  }

  const bulkApprove = async () => {
    if (selected.size === 0) return
    setBulkBusy(true)
    try {
      await api.admin.bulkAction({ photoIds: Array.from(selected), action: "approve" })
      toast.success(t.admin.moderation.bulkApprovedMsg)
      deselectAll()
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err) ?? t.admin.moderation.actionError)
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <AdminLayout>
      <h1 className="font-display text-4xl text-accent-dark">{t.admin.moderation.title}</h1>
      <p className="mt-1 text-sm text-ink/50">{t.admin.moderation.subtitle}</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => {
              setTab(tb.key)
              setPage(1)
              deselectAll()
            }}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === tb.key ? "bg-accent text-white" : "bg-white text-ink/60 hover:bg-accent-soft",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={allSelected ? deselectAll : selectAll}
          disabled={photos.length === 0}
          className="inline-flex min-h-11 items-center rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-soft disabled:opacity-40"
        >
          {allSelected ? t.admin.moderation.deselectAll : t.admin.moderation.selectAll}
        </button>
        {selected.size > 0 ? (
          <>
            <span className="text-sm text-ink/50">
              {interp(t.admin.moderation.selectedCount, { count: selected.size })}
            </span>
            <Button size="sm" loading={bulkBusy} onClick={bulkApprove}>
              {t.admin.moderation.bulkApprove}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={bulkBusy}
              onClick={() => setRejectTarget("bulk")}
            >
              {t.admin.moderation.bulkReject}
            </Button>
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => `mod-skel-${i}`).map((key) => (
            <div key={key} className="skeleton aspect-square rounded-2xl" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
            <ImageOff className="h-8 w-8 text-accent" />
          </div>
          <p className="font-display text-2xl text-ink">{t.admin.moderation.emptyFilter}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, i) => (
              <PhotoModerationCard
                key={photo.id}
                photo={photo}
                selected={selected.has(photo.id)}
                busy={busyId === photo.id}
                onToggleSelect={() => toggleSelect(photo.id)}
                onApprove={() => approve(photo.id)}
                onReject={() => setRejectTarget(photo.id)}
                onDelete={() => remove(photo.id)}
                onOpen={() => setLightboxIndex(i)}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex min-h-11 items-center gap-1 rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm text-accent-dark disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> {t.admin.moderation.prev}
              </button>
              <span className="text-sm text-ink/50">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex min-h-11 items-center gap-1 rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm text-accent-dark disabled:opacity-40"
              >
                {t.admin.moderation.next} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </>
      )}

      <Modal
        open={rejectTarget !== null}
        onClose={() => {
          setRejectTarget(null)
          setRejectReason("")
        }}
        title={t.admin.moderation.rejectModal.title}
      >
        <p className="mb-4 text-sm text-ink/60">{t.admin.moderation.rejectModal.hint}</p>
        <Input
          label={t.admin.moderation.rejectModal.reasonLabel}
          placeholder={t.admin.moderation.rejectModal.reasonPlaceholder}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setRejectTarget(null)
              setRejectReason("")
            }}
          >
            {t.admin.moderation.rejectModal.cancel}
          </Button>
          <Button variant="danger" loading={bulkBusy || busyId !== null} onClick={confirmReject}>
            {t.admin.moderation.rejectModal.confirm}
          </Button>
        </div>
      </Modal>

      <Lightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </AdminLayout>
  )
}
