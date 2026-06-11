"use client"

import { useI18n } from "@/providers/I18nProvider"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    // Surface unexpected render errors for debugging.
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 text-center">
      <h1 className="font-display text-5xl text-accent-dark">{t.errorBoundary.title}</h1>
      <p className="mt-3 max-w-md text-ink/60">{t.errorBoundary.subtitle}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
      >
        {t.errorBoundary.retry}
      </button>
    </main>
  )
}
