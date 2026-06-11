"use client"

import { QrInline } from "@/components/QrInline"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { Button } from "@/components/ui/Button"
import { CopyButton } from "@/components/ui/CopyButton"
import { Spinner } from "@/components/ui/Spinner"
import { useEventCopy } from "@/hooks/useEventCopy"
import { ApiClientError, api } from "@/lib/api"
import { SITE_URL } from "@/lib/event"
import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"
import { format } from "date-fns"
import { Calendar, Download, FileText, ImageIcon, MapPin, QrCode } from "lucide-react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { useEffect, useState } from "react"
import { toast } from "sonner"

// Build a filesystem-safe base name from the event title (diacritics stripped),
// e.g. "Melek & Recep" → "melek-recep". Falls back to the app name when empty.
function eventFileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    // biome-ignore lint/suspicious/noMisleadingCharacterClass: intentional \u2014 strips the combining diacritic marks that NFD splits off (\u00e9\u2192e, \u015f\u2192s)
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "pixfete"
}

export default function AdminQrPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { event, locale } = useEvent()
  const copy = useEventCopy()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  // This page has no protected data of its own, so verify the admin session
  // explicitly — otherwise the (admin-only) download would be reachable by URL.
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let active = true
    api.admin
      .getStats()
      .then(() => {
        if (active) setAuthChecked(true)
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiClientError && err.status === 401) {
          router.replace("/admin")
        } else {
          // Non-auth error (e.g. network) — let the page render anyway.
          setAuthChecked(true)
        }
      })
    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    let active = true
    QRCode.toDataURL(SITE_URL, {
      width: 600,
      margin: 1,
      color: { dark: "#7d5790", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url)
      })
      .catch(() => {
        if (active) toast.error(t.qr.qrError)
      })
    return () => {
      active = false
    }
  }, [t.qr.qrError])

  const downloadPng = () => {
    if (!qrDataUrl) return
    const link = document.createElement("a")
    link.href = qrDataUrl
    link.download = `${eventFileSlug(event.title)}-qr.png`
    link.click()
    toast.success(t.qr.pngDownloaded)
  }

  const downloadPdf = async () => {
    if (!qrDataUrl) return
    setPdfLoading(true)
    try {
      const [{ pdf }, { InvitationPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/qr/InvitationPdf"),
      ])
      // Short numeric date (11.07.2026), no time. Falls back to the localized
      // label if the event date isn't a parseable ISO string.
      const parsedDate = event.date ? new Date(event.date) : null
      const shortDate =
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? format(parsedDate, "dd.MM.yyyy")
          : t.home.eventDate
      const blob = await pdf(
        <InvitationPdf
          qrDataUrl={qrDataUrl}
          event={event}
          dateLabel={shortDate}
          welcome={copy.welcome}
          locale={locale}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${eventFileSlug(event.title)}-invitation.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(copy.pdfDownloaded)
    } catch {
      toast.error(t.qr.pdfError)
    } finally {
      setPdfLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20">
          <Spinner className="h-10 w-10" />
        </div>
      </AdminLayout>
    )
  }

  const venue = [event.venueName, event.venueAddress].filter(Boolean).join(", ")

  return (
    <AdminLayout>
      <h1 className="font-display text-4xl text-accent-dark">{copy.qrTitle}</h1>
      <p className="mt-1 text-sm text-ink/50">{t.qr.description}</p>

      <div className="mt-8 grid max-w-5xl items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* QR preview — the hero of the page */}
        <section className="overflow-hidden rounded-3xl border border-accent-soft bg-white shadow-sm">
          <div className="flex flex-col items-center bg-gradient-to-b from-accent-soft/40 to-white px-8 pt-10 pb-8">
            <div className="rounded-2xl border border-accent-soft bg-white p-5 shadow-sm">
              <QrInline value={SITE_URL} size={240} className="rounded-lg" />
            </div>
            <p className="mt-6 font-display text-3xl text-accent-dark">{event.title}</p>
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-accent-soft/60 px-3 py-1">
              <QrCode className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate text-xs text-ink/60">{SITE_URL}</span>
            </div>
          </div>
        </section>

        {/* Actions + details */}
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-accent-soft bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-medium tracking-[0.2em] text-accent uppercase">
              {t.qr.eyebrow}
            </p>
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={downloadPng}
                disabled={!qrDataUrl}
                className="w-full cursor-pointer justify-center"
              >
                <Download className="h-4 w-4" />
                {t.qr.pngBtn}
              </Button>
              <Button
                variant="secondary"
                onClick={downloadPdf}
                disabled={!qrDataUrl}
                loading={pdfLoading}
                className="w-full cursor-pointer justify-center"
              >
                {pdfLoading ? null : <FileText className="h-4 w-4" />}
                {copy.pdfBtn}
              </Button>
              <CopyButton text={SITE_URL} label={t.qr.copyLink} className="w-full justify-center" />
            </div>
            {!qrDataUrl ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink/40">
                <Spinner className="h-4 w-4" />
                {t.qr.preparing}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-accent-soft bg-accent-soft/30 p-6">
            <h2 className="font-display text-xl text-ink">{copy.cardTitle}</h2>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-ink/70">
              <li className="flex items-center gap-3">
                <Calendar className="h-4 w-4 shrink-0 text-accent" />
                <span>{t.qr.cardDate}</span>
              </li>
              {venue ? (
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 shrink-0 text-accent" />
                  <span>{venue}</span>
                </li>
              ) : null}
              <li className="flex items-center gap-3">
                <ImageIcon className="h-4 w-4 shrink-0 text-accent" />
                <span>{t.qr.cardQrLine}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </AdminLayout>
  )
}
