"use client"

import { interp } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { MessageCircle } from "lucide-react"

interface WhatsAppSendHelperProps {
  /** Organizer WhatsApp number (free-form; sanitized to digits for wa.me). */
  number: string
  /** Uploader's name, woven into the prefilled message when available. */
  uploaderName?: string | undefined
  className?: string | undefined
}

/** Builds a wa.me deep link, or null if the number has too few digits. */
function buildWhatsAppUrl(number: string, text: string): string | null {
  const digits = number.replace(/\D/g, "")
  if (digits.length < 7) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/**
 * Fallback for guests who can't upload (e.g. flaky connection): send the
 * photo/video straight to the organizer over WhatsApp. Includes a collapsible
 * how-to for sending at full/HD quality on iOS and Android. Renders nothing
 * unless a usable number is configured.
 */
export function WhatsAppSendHelper({ number, uploaderName, className }: WhatsAppSendHelperProps) {
  const { t } = useI18n()
  const w = t.whatsapp
  const name = uploaderName?.trim()
  const text = name ? interp(w.prefill, { name }) : w.prefillNoName
  const href = buildWhatsAppUrl(number, text)
  if (!href) return null

  return (
    <div className={cn("rounded-2xl border border-green-200 bg-green-50/60 p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-ink">{w.title}</p>
          <p className="mt-0.5 text-sm text-ink/60">{w.desc}</p>
        </div>
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-green-700 hover:text-green-800">
          {w.howToTitle}
        </summary>
        <div className="mt-2 flex flex-col gap-3 text-sm text-ink/70">
          <div>
            <p className="font-medium text-ink/80">{w.iosTitle}</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              {w.iosSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-medium text-ink/80">{w.androidTitle}</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              {w.androidSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-ink/50">{w.note}</p>
        </div>
      </details>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600 sm:w-auto"
      >
        <MessageCircle className="h-4 w-4" />
        {w.sendButton}
      </a>
    </div>
  )
}
