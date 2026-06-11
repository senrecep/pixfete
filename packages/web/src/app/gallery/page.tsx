"use client"

import { Lightbox } from "@/components/gallery/Lightbox"
import { PhotoGrid } from "@/components/gallery/PhotoGrid"
import { Footer } from "@/components/layout/Footer"
import { Header } from "@/components/layout/Header"
import { Spinner } from "@/components/ui/Spinner"
import { useApiError } from "@/hooks/useApiError"
import { useEventCopy } from "@/hooks/useEventCopy"
import { api } from "@/lib/api"
import type { Photo } from "@/lib/types"
import { useI18n } from "@/providers/I18nProvider"
import { ImageOff } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export default function GalleryPage() {
  const { t } = useI18n()
  const copy = useEventCopy()
  const { getErrorMessage } = useApiError()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingRef = useRef(false)

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await api.photos.getApproved(nextPage)
        setPhotos((prev) => (nextPage === 1 ? res.photos : [...prev, ...res.photos]))
        setTotalPages(res.totalPages)
        setPage(res.page)
      } catch (err) {
        toast.error(getErrorMessage(err) ?? t.gallery.loadError)
      } finally {
        setLoading(false)
        setInitialLoaded(true)
        loadingRef.current = false
      }
    },
    [getErrorMessage, t.gallery.loadError],
  )

  useEffect(() => {
    void loadPage(1)
  }, [loadPage])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && page < totalPages && !loadingRef.current) {
          void loadPage(page + 1)
        }
      },
      { rootMargin: "400px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [page, totalPages, loadPage])

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[70dvh] max-w-6xl px-5 py-12">
        <div className="mb-10 text-center">
          <p className="text-sm tracking-[0.3em] text-accent uppercase">{t.gallery.eyebrow}</p>
          <h1 className="mt-2 font-display text-5xl text-accent-dark">{copy.galleryTitle}</h1>
        </div>

        {!initialLoaded ? (
          <div className="masonry">
            {Array.from({ length: 8 }, (_, i) => `gallery-skel-${i}`).map((key, i) => (
              <div
                key={key}
                className="skeleton mb-4 rounded-2xl"
                style={{ height: `${180 + (i % 3) * 70}px` }}
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
              <ImageOff className="h-8 w-8 text-accent" />
            </div>
            <p className="font-display text-2xl text-ink">{t.gallery.emptyTitle}</p>
            <p className="mt-1 text-sm text-ink/50">{t.gallery.emptySub}</p>
          </div>
        ) : (
          <>
            <PhotoGrid photos={photos} onSelect={setLightboxIndex} />
            <div ref={sentinelRef} className="h-10" />
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : null}
          </>
        )}
      </main>
      <Footer />

      <Lightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </>
  )
}
