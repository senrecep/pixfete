"use client"

import { useEventCopy } from "@/hooks/useEventCopy"
import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"
import { differenceInSeconds } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** before = counting down · day = celebration window · after = counting up */
type Phase = "before" | "day" | "after"

// The wedding day itself: a 24h window after the start where we show the
// "big day is here" message instead of a counter.
const DAY_WINDOW_SECONDS = 86400

function breakdown(total: number): TimeLeft {
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

const ZERO: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 }

function compute(eventTime: number): { phase: Phase; time: TimeLeft } {
  const toEvent = differenceInSeconds(eventTime, Date.now())
  if (toEvent > 0) return { phase: "before", time: breakdown(toEvent) }

  const sinceEvent = -toEvent
  if (sinceEvent < DAY_WINDOW_SECONDS) return { phase: "day", time: ZERO }
  // After the wedding day: count up the time elapsed since the wedding.
  return { phase: "after", time: breakdown(sinceEvent) }
}

export function Countdown() {
  const { t } = useI18n()
  const { event } = useEvent()
  const copy = useEventCopy()
  const eventTime = new Date(event.date).getTime()
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<{ phase: Phase; time: TimeLeft }>({
    phase: "before",
    time: ZERO,
  })

  useEffect(() => {
    if (Number.isNaN(eventTime)) return
    setMounted(true)
    setState(compute(eventTime))
    const interval = setInterval(() => setState(compute(eventTime)), 1000)
    return () => clearInterval(interval)
  }, [eventTime])

  // No valid event date configured yet — render nothing.
  if (Number.isNaN(eventTime)) return null

  const units: Array<{ key: keyof TimeLeft; label: string }> = [
    { key: "days", label: t.home.countdown.days },
    { key: "hours", label: t.home.countdown.hours },
    { key: "minutes", label: t.home.countdown.minutes },
    { key: "seconds", label: t.home.countdown.seconds },
  ]

  // The wedding day window: single celebratory message, no counter.
  if (mounted && state.phase === "day") {
    return <p className="font-display text-3xl text-accent-dark">{copy.eventDay}</p>
  }

  const isAfter = mounted && state.phase === "after"

  return (
    <div className="flex flex-col items-center gap-3">
      {isAfter ? (
        <p className="font-display text-lg text-accent-dark sm:text-xl">{copy.elapsedTitle}</p>
      ) : null}
      <div className="flex items-center justify-center gap-3 sm:gap-5" aria-live="polite">
        {units.map((unit) => {
          const value = state.time[unit.key]
          const padded = String(value).padStart(2, "0")
          return (
            <div key={unit.key} className="flex flex-col items-center">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-accent-light/40 bg-white/80 shadow-sm backdrop-blur-sm sm:h-24 sm:w-24">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={padded}
                    initial={{ y: "-100%", opacity: 0 }}
                    animate={{ y: "0%", opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="absolute font-display text-3xl font-semibold text-accent-dark sm:text-5xl"
                  >
                    {mounted ? padded : "--"}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="mt-2 text-[0.65rem] tracking-widest text-ink/50 uppercase sm:text-xs">
                {unit.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
