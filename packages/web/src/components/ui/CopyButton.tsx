"use client"

import { cn } from "@/lib/utils"
import { copyToClipboard } from "@/lib/utils"
import { useI18n } from "@/providers/I18nProvider"
import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onCopy = async () => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      toast.success(t.copyButton.success)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error(t.copyButton.error)
    }
  }

  const buttonLabel = label ?? t.copyButton.label

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-soft",
        className,
      )}
      aria-label={buttonLabel}
    >
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      {copied ? t.copyButton.copied : buttonLabel}
    </button>
  )
}
