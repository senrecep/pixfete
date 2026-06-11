import { SITE_URL } from "@/lib/event"
import { Providers } from "@/providers/Providers"
import type { Metadata, Viewport } from "next"
import { Cormorant_Garamond, Inter } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

// Neutral fallback; the real document title is set at runtime from the
// admin-managed event title (see EventProvider).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Pixfete",
  description: "Share your event photos.",
  openGraph: {
    title: "Pixfete",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#9b72aa",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream text-ink antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              fontFamily: "var(--font-body)",
            },
          }}
        />
      </body>
    </html>
  )
}
