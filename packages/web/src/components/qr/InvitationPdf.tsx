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

const styles = StyleSheet.create({
  // A5 landscape; the card fills the page with a soft padding margin.
  page: {
    backgroundColor: "#fdfcfb",
    padding: 28,
    fontFamily: "Lato",
  },
  card: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#c4a5d4",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 40,
    backgroundColor: "#ffffff",
  },
  welcome: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#9b72aa",
    marginBottom: 14,
  },
  names: {
    fontSize: 40,
    color: "#7d5790",
    fontFamily: "Crimson Text",
  },
  divider: {
    width: 56,
    height: 1.5,
    backgroundColor: "#c4a5d4",
    marginVertical: 16,
  },
  qr: {
    width: 132,
    height: 132,
    marginBottom: 16,
  },
  date: {
    fontSize: 12,
    color: "#2e2a33",
  },
})

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
  // Locale-aware uppercase: Turkish maps i → İ, English keeps i → I. Using the
  // wrong locale would garble the other language (e.g. "Invitation" → "İNVİTATİON").
  const upperLocale = locale === "tr" ? "tr-TR" : "en-US"
  return (
    <Document title={`${event.title} — ${welcome}`}>
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.welcome}>{welcome.toLocaleUpperCase(upperLocale)}</Text>
          <Text style={styles.names}>{event.title}</Text>

          <View style={styles.divider} />

          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <PdfImage src={qrDataUrl} style={styles.qr} />
          <Text style={styles.date}>{dateLabel}</Text>
        </View>
      </Page>
    </Document>
  )
}
