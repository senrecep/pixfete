"use client"

import { useI18n } from "@/providers/I18nProvider"
import Link from "next/link"

export default function NotFound() {
  const { t } = useI18n()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-5 text-center">
      <p className="font-display text-7xl text-accent-light">404</p>
      <h1 className="mt-2 font-display text-4xl text-accent-dark">{t.notFound.title}</h1>
      <p className="mt-3 text-ink/60">{t.notFound.subtitle}</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
      >
        {t.notFound.backHome}
      </Link>
    </main>
  )
}
