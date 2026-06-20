"use client"

import { Button } from "@/components/ui/Button"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { useVideoProcessor } from "@/hooks/useVideoProcessor"
import type { VideoProcessOptions } from "@/hooks/useVideoProcessor"
import { interp } from "@/lib/i18n"
import { useI18n } from "@/providers/I18nProvider"
import { AnimatePresence, motion } from "framer-motion"
import { Scissors, Upload, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface VideoProcessCardProps {
  file: File
  onProcessed: (file: File) => void
  onSkip: () => void
  onCancel: () => void
}

export function VideoProcessCard({ file, onProcessed, onSkip, onCancel }: VideoProcessCardProps) {
  const { t } = useI18n()
  const vp = t.upload.videoProcess
  const { process, state, reset, cancel } = useVideoProcessor()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const isProcessing = state.phase === "loading" || state.phase === "processing"
  const hasTrim = trimStart > 0 || trimEnd < duration
  const selectedDuration = trimEnd - trimStart

  // Selected clip visual: percentage of total timeline
  const leftPct = duration > 0 ? (trimStart / duration) * 100 : 0
  const rightPct = duration > 0 ? ((duration - trimEnd) / duration) * 100 : 0

  function handleLoadedMetadata() {
    const vid = videoRef.current
    if (!vid) return
    const d = vid.duration ?? 0
    setDuration(d)
    setTrimEnd(d)
  }

  function handleProcess() {
    const opts: VideoProcessOptions = { quality: "balanced", resolution: "original" }
    if (trimStart > 0) opts.trimStart = trimStart
    if (trimEnd < duration) opts.trimEnd = trimEnd
    process(file, opts).then((result) => {
      if (result) onProcessed(result)
    })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm">
        <motion.div
          className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl pb-safe"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold text-ink">{vp.title}</h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full p-2 text-ink/40 transition-colors hover:bg-accent-soft hover:text-accent-dark cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={vp.closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-6 space-y-5">
            {/* Video preview */}
            {objectUrl ? (
              <video
                ref={videoRef}
                src={objectUrl}
                controls
                autoPlay={false}
                muted
                playsInline
                onLoadedMetadata={handleLoadedMetadata}
                aria-label={interp(vp.title, { name: file.name })}
                className="w-full rounded-2xl bg-black aspect-video object-contain"
              />
            ) : null}

            {/* Trim section — only shown when video metadata is loaded */}
            {duration > 0 ? (
              <div className="space-y-4 bg-accent-soft/50 rounded-2xl p-4">
                <p className="text-sm font-semibold text-ink text-center">{vp.trimQuestion}</p>

                {/* Visual timeline bar */}
                <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 bg-accent rounded-full transition-all duration-75"
                    style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
                  />
                </div>

                {/* Duration indicator */}
                <p className="text-center text-sm font-medium text-accent">
                  {hasTrim
                    ? interp(vp.selectedDuration, { duration: selectedDuration.toFixed(0) })
                    : interp(vp.fullDuration, { duration: duration.toFixed(0) })}
                </p>

                {/* Start slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-ink/50">
                    <label htmlFor="trim-start">{vp.startLabel}</label>
                    <span className="tabular-nums font-medium">{trimStart.toFixed(1)}s</span>
                  </div>
                  <input
                    id="trim-start"
                    type="range"
                    min={0}
                    max={Math.max(0, trimEnd - 0.5)}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 accent-[var(--color-accent)] disabled:opacity-50 cursor-pointer"
                    style={{ touchAction: "manipulation" }}
                  />
                </div>

                {/* End slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-ink/50">
                    <label htmlFor="trim-end">{vp.endLabel}</label>
                    <span className="tabular-nums font-medium">{trimEnd.toFixed(1)}s</span>
                  </div>
                  <input
                    id="trim-end"
                    type="range"
                    min={Math.min(trimStart + 0.5, duration)}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full h-2 accent-[var(--color-accent)] disabled:opacity-50 cursor-pointer"
                    style={{ touchAction: "manipulation" }}
                  />
                </div>
              </div>
            ) : null}

            {/* Progress */}
            {isProcessing ? (
              <div className="space-y-2">
                <ProgressBar value={state.progress} />
                <p className="text-center text-sm text-ink/60">
                  {state.phase === "loading"
                    ? vp.preparing
                    : interp(vp.processing, { progress: String(state.progress) })}
                </p>
              </div>
            ) : null}

            {/* Error */}
            {state.phase === "error" && state.error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-center">
                <p className="text-sm text-red-600 font-medium">{state.error}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 text-sm font-semibold text-red-700 underline cursor-pointer"
                >
                  {vp.retryBtn}
                </button>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-1">
              <Button
                variant="primary"
                size="md"
                loading={isProcessing}
                onClick={handleProcess}
                className="w-full min-h-[52px] text-base font-semibold rounded-2xl"
              >
                <Scissors className="h-4 w-4" />
                {hasTrim ? vp.trimBtn : vp.processBtn}
              </Button>

              {isProcessing ? (
                <Button
                  variant="secondary"
                  onClick={cancel}
                  className="w-full min-h-[52px] rounded-2xl"
                >
                  {vp.cancelBtn}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={onSkip}
                  disabled={isProcessing}
                  className="w-full min-h-[52px] rounded-2xl"
                >
                  <Upload className="h-4 w-4" />
                  {vp.skipBtn}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
