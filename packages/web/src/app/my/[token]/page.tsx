"use client"

import { Lightbox } from "@/components/gallery/Lightbox"
import { Footer } from "@/components/layout/Footer"
import { Header } from "@/components/layout/Header"
import { Badge } from "@/components/ui/Badge"
import { CopyButton } from "@/components/ui/CopyButton"
import { MediaThumb } from "@/components/ui/MediaThumb"
import { Spinner } from "@/components/ui/Spinner"
import { useApiError } from "@/hooks/useApiError"
import { api } from "@/lib/api"
import { SITE_URL } from "@/lib/event"
import { photoSrc } from "@/lib/photo"
import type { Photo } from "@/lib/types"
import { formatBytes } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import type { PhotoStatus } from "@pixfete/shared"
import { format } from "date-fns"
import { Clock, ImageOff, UploadCloud } from "lucide-react"
import Link from "next/link"
import { use, useEffect, useState } from "react"
import { toast } from "sonner"

export default function MyPhotosPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const { t } = useI18n()
  const { getErrorMessage } = useApiError()

  const [uploaderName, setUploaderName] = useState("")
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Lightbox is scoped to the clicked section's list so navigation stays within
  // the same status group (pending/approved/rejected).
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null)

  const sections: Array<{ status: PhotoStatus; title: string; hint: string }> = [
    {
      status: "pending",
      title: t.myPhotos.sections.pending.title,
      hint: t.myPhotos.sections.pending.hint,
    },
    {
      status: "approved",
      title: t.myPhotos.sections.approved.title,
      hint: t.myPhotos.sections.approved.hint,
    },
    {
      status: "rejected",
      title: t.myPhotos.sections.rejected.title,
      hint: t.myPhotos.sections.rejected.hint,
    },
  ]

  useEffect(() => {
    let active = true
    setLoading(true)
    api.photos
      .getMine(token)
      .then((res) => {
        if (!active) return
        setUploaderName(res.uploaderName)
        setPhotos(res.photos)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = getErrorMessage(err) ?? t.myPhotos.loadError
        setError(message)
        toast.error(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token, getErrorMessage, t.myPhotos.loadError])

  const personalUrl = `${SITE_URL}/my/${token}`

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[70dvh] max-w-4xl px-5 py-12">
        <div className="mb-8 text-center">
          <p className="text-sm tracking-[0.3em] text-accent uppercase">{t.myPhotos.eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl text-accent-dark">
            {uploaderName ? uploaderName : t.myPhotos.defaultTitle}
          </h1>
        </div>

        <div className="mb-10 flex flex-col items-center gap-3 rounded-2xl border border-accent-soft bg-accent-soft/40 p-5 text-center">
          <p className="text-sm text-ink/60">{t.myPhotos.shareHint}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/upload?resume=${token}`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
            >
              <UploadCloud className="h-4 w-4" />
              {t.myPhotos.addPhotos}
            </Link>
            <CopyButton text={personalUrl} label={t.myPhotos.copyLink} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-10 w-10" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <ImageOff className="h-8 w-8 text-red-400" />
            </div>
            <p className="font-display text-2xl text-ink">{t.myPhotos.invalidTitle}</p>
            <p className="mt-1 text-sm text-ink/50">{error}</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
              <Clock className="h-8 w-8 text-accent" />
            </div>
            <p className="font-display text-2xl text-ink">{t.myPhotos.noPhotosTitle}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {sections.map((section) => {
              const list = photos.filter((p) => p.status === section.status)
              if (list.length === 0) return null
              return (
                <section key={section.status}>
                  <div className="mb-4 flex items-center gap-3">
                    <Badge status={section.status} />
                    <h2 className="font-display text-2xl text-ink">{section.title}</h2>
                    <span className="text-sm text-ink/40">({list.length})</span>
                  </div>
                  <p className="mb-4 text-sm text-ink/50">{section.hint}</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {list.map((photo, i) => {
                      const src = photoSrc(photo, token)
                      return (
                        <div
                          key={photo.id}
                          className="overflow-hidden rounded-xl border border-accent-soft bg-white"
                        >
                          <div className="flex aspect-square items-center justify-center bg-accent-soft">
                            {src ? (
                              <button
                                type="button"
                                onClick={() => setLightbox({ photos: list, index: i })}
                                className="relative h-full w-full cursor-zoom-in"
                                aria-label={photo.fileName}
                              >
                                <MediaThumb
                                  src={src}
                                  photo={photo}
                                  alt={photo.fileName}
                                  badge="sm"
                                  fallbackLabel={t.media.unavailableUploaded}
                                />
                              </button>
                            ) : (
                              <ImageOff className="h-7 w-7 text-accent/40" />
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs text-ink/50">
                              {format(photo.uploadedAt, "dd.MM.yyyy HH:mm")}
                            </p>
                            <p className="text-xs text-ink/40">{formatBytes(photo.originalSize)}</p>
                            {photo.status === "rejected" && photo.rejectionReason ? (
                              <p className="mt-1 text-xs text-red-500">{photo.rejectionReason}</p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
      <Footer />

      <Lightbox
        photos={lightbox?.photos ?? []}
        index={lightbox ? lightbox.index : null}
        viewerToken={token}
        onClose={() => setLightbox(null)}
        onNavigate={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : prev))}
      />
    </>
  )
}
