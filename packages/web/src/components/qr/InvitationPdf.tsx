"use client"

import type { EventConfig, Locale } from "@/lib/types"
import {
  Document,
  Font,
  Page,
  Image as PdfImage,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

// The built-in PDF fonts (Helvetica/Times-Roman) lack Turkish glyphs (ğ İ ı ş ç),
// which dropped/garbled them (e.g. "DÜĞÜN" → "DÜ ÜN", "Fotoğraflarınızı" → "...1n1z1").
// Register COMPLETE static TTFs (full latin + latin-ext, not a partial subset) served
// from /public/fonts: Lato for body text, Crimson Text (a Garamond-style serif close
// to the site's Cormorant) for the names. Both cover every Turkish character.
Font.register({
  family: "Lato",
  fonts: [
    { src: "/fonts/Lato-Regular.ttf" },
    { src: "/fonts/Lato-Italic.ttf", fontStyle: "italic" },
  ],
})
Font.register({
  family: "Crimson Text",
  fonts: [{ src: "/fonts/CrimsonText-SemiBold.ttf" }],
})
// Disable hyphenation so Turkish words never split mid-word.
Font.registerHyphenationCallback((word) => [word])

// StyleSheet.create is static (module-level); dynamic accent colors are applied
// as inline style merges inside the component: [base.x, { color: accent }].
// A6 is A5 scaled by 1/sqrt(2) (~0.707) on both axes, so every fixed-pt
// value below is the A5 original scaled by the same factor to keep the
// card's proportions identical on the smaller page instead of overflowing it.
const base = StyleSheet.create({
  page: { backgroundColor: "#fdfcfb", padding: 20, fontFamily: "Lato" },
  card: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
  },
  left: {
    flex: 1,
    paddingVertical: 25,
    paddingHorizontal: 27,
    justifyContent: "center",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  welcome: { fontSize: 6, letterSpacing: 2, marginBottom: 11 },
  names: { fontSize: 27, fontFamily: "Crimson Text", lineHeight: 1.1 },
  divider: { width: 31, height: 1, marginTop: 14, marginBottom: 13 },
  date: { fontSize: 8 },
  right: {
    width: 136,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  qr: { width: 106, height: 106 },
})

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m?.[1] || !m[2] || !m[3]) return null
  return [Number.parseInt(m[1], 16), Number.parseInt(m[2], 16), Number.parseInt(m[3], 16)]
}

const toHex = (n: number) => n.toString(16).padStart(2, "0")

function lighten(hex: string, t: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#f5f0fa"
  return `#${toHex(Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * t)))}${toHex(Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * t)))}${toHex(Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * t)))}`
}

function darken(hex: string, t: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#4a2e60"
  return `#${toHex(Math.round(rgb[0] * (1 - t)))}${toHex(Math.round(rgb[1] * (1 - t)))}${toHex(Math.round(rgb[2] * (1 - t)))}`
}

export function InvitationPdf({
  qrDataUrl,
  event,
  dateLabel,
  welcome,
  locale,
}: {
  qrDataUrl: string
  event: EventConfig
  dateLabel: string
  welcome: string
  locale: Locale
}) {
  const accent = event.accentColor || "#9b72aa"
  const accentLight = lighten(accent, 0.92)
  const accentDark = darken(accent, 0.15)
  // Locale-aware uppercase: Turkish maps i → İ, English keeps i → I. Using the
  // wrong locale would garble the other language (e.g. "Invitation" → "İNVİTATİON").
  const upperLocale = locale === "tr" ? "tr-TR" : "en-US"

  return (
    <Document title={`${event.title} — ${welcome}`}>
      <Page size="A6" orientation="landscape" style={base.page}>
        <View style={[base.card, { borderColor: accent }]}>
          {/* Left: text panel with light accent tint */}
          <View style={[base.left, { backgroundColor: accentLight }]}>
            <Text style={[base.welcome, { color: accent }]}>
              {welcome.toLocaleUpperCase(upperLocale)}
            </Text>
            <Text style={[base.names, { color: accentDark }]}>{event.title}</Text>
            <View style={[base.divider, { backgroundColor: accent }]} />
            <Text style={[base.date, { color: accentDark }]}>{dateLabel}</Text>
          </View>
          {/* Right: QR panel on clean white */}
          <View style={base.right}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <PdfImage src={qrDataUrl} style={base.qr} />
          </View>
        </View>
      </Page>
    </Document>
  )
}
