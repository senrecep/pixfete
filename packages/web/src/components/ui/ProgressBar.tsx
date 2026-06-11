"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export function ProgressBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: progressbar is a status indicator, not an interactive control
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-accent-soft", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent-light to-accent"
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ ease: "easeOut", duration: 0.3 }}
      />
    </div>
  )
}
