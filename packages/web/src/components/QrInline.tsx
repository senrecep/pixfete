"use client"

import { interp } from "@/lib/i18n"
import { useI18n } from "@/providers/I18nProvider"
import QRCode from "qrcode"
import { useEffect, useState } from "react"

interface QrInlineProps {
  value: string
  size?: number
  className?: string
  color?: string
}

// Renders a QR code as a data-URL <img>. Client-only (uses canvas via qrcode lib).
export function QrInline({ value, size = 160, className, color = "#7d5790" }: QrInlineProps) {
  const { t } = useI18n()
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: color, light: "#ffffff" },
    })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setDataUrl(null)
      })
    return () => {
      active = false
    }
  }, [value, size, color])

  if (!dataUrl) {
    return (
      <div
        className="skeleton rounded-xl"
        style={{ width: size, height: size }}
        aria-label={t.qr.loadingAlt}
      />
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      alt={interp(t.qr.imgAlt, { value })}
      width={size}
      height={size}
      className={className}
    />
  )
}
