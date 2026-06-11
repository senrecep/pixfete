"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { useEffect } from "react"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // biome-ignore lint/a11y/useSemanticElements: animated overlay requires a motion.div, not a native <dialog>
          role="dialog"
          aria-modal="true"
          aria-label={title ?? "Modal"}
        >
          <button
            type="button"
            aria-label="Kapat"
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl",
              className,
            )}
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="mb-4 flex items-center justify-between">
              {title ? <h2 className="font-display text-2xl text-ink">{title}</h2> : <span />}
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="-mr-1.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-accent-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
