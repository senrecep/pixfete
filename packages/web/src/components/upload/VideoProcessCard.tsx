"use client"

import { Button } from "@/components/ui/Button"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { useVideoProcessor } from "@/hooks/useVideoProcessor"
import type { VideoProcessOptions, VideoQuality } from "@/hooks/useVideoProcessor"
import { cn, formatBytes } from "@/lib/utils"
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
  const { process, state, reset, cancel } = useVideoProcessor()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [quality, setQuality] = useState<VideoQuality>("balanced")
  const [resolution, setResolution] = useState<"original" | "1080p" | "720p" | "480p">("1080p")

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  const isProcessing = state.phase === "loading" || state.phase === "processing"
  const hasTrim = trimStart > 0 || trimEnd < duration

  function handleLoadedMetadata() {
    const vid = videoRef.current
    if (!vid) return
    const d = vid.duration ?? 0
    setDuration(d)
    setTrimEnd(d)
  }

  // Approximate bitrates in Mbps for given quality+resolution
  function estimateFileSizeMB(dur: number, qual: VideoQuality, res: string): number {
    if (dur <= 0) return 0
    const bitrates: Record<string, Record<string, number>> = {
      max: { original: 12, "1080p": 12, "720p": 6, "480p": 3 },
      balanced: { original: 5, "1080p": 5, "720p": 2.5, "480p": 1.5 },
    }
    const mbps = bitrates[qual]?.[res] ?? 5
    return Math.round((dur * mbps) / 8)
  }

  function handleProcess() {
    const opts: VideoProcessOptions = { quality, resolution }
    if (trimStart > 0) opts.trimStart = trimStart
    if (trimEnd < duration) opts.trimEnd = trimEnd
    process(file, opts).then((result) => {
      if (result) onProcessed(result)
    })
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <motion.div
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold text-ink">Video Düzenle</h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full p-1.5 text-ink/40 transition-colors hover:bg-accent-soft hover:text-accent-dark"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-4">
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
                className="w-full rounded-xl bg-black aspect-video object-contain"
              />
            ) : null}

            {/* File info */}
            <p className="text-xs text-ink/50 truncate">
              {file.name}
              <span className="ml-2 text-ink/40">{formatBytes(file.size)}</span>
            </p>

            {/* Trim controls */}
            {duration > 0 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="trim-start" className="text-xs font-medium text-ink/60">
                      Başlangıç
                    </label>
                    <span className="text-xs tabular-nums text-accent-dark">
                      {trimStart.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    id="trim-start"
                    type="range"
                    min={0}
                    max={Math.max(0, trimEnd - 0.1)}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full accent-[var(--color-accent)] disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="trim-end" className="text-xs font-medium text-ink/60">
                      Bitiş
                    </label>
                    <span className="text-xs tabular-nums text-accent-dark">
                      {trimEnd.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    id="trim-end"
                    type="range"
                    min={Math.min(trimStart + 0.1, duration)}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Number(e.target.value))}
                    disabled={isProcessing}
                    className="w-full accent-[var(--color-accent)] disabled:opacity-50"
                  />
                </div>
              </div>
            ) : null}

            {/* Quality picker */}
            <div className="flex gap-2">
              {(["balanced", "max"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  disabled={isProcessing}
                  className={cn(
                    "flex-1 rounded-full border px-3 py-2 text-xs font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
                    quality === q
                      ? "border-accent bg-accent text-white"
                      : "border-accent-light/50 bg-accent-soft text-accent-dark hover:bg-accent-light/40",
                  )}
                >
                  {q === "balanced" ? "Dengeli" : "Maksimum Kalite"}
                </button>
              ))}
            </div>

            {/* Resolution picker */}
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-ink/60">Çözünürlük</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(["original", "1080p", "720p", "480p"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    className={cn(
                      "rounded-full border py-1.5 text-xs font-medium transition-colors",
                      resolution === r
                        ? "border-accent bg-accent text-white"
                        : "border-accent-light/50 bg-accent-soft text-accent-dark hover:bg-accent-light/40",
                    )}
                  >
                    {r === "original" ? "Asıl" : r}
                  </button>
                ))}
              </div>
            </div>

            {duration > 0 && (
              <p className="mb-4 text-xs text-ink/40">
                Tahmini boyut: ~{estimateFileSizeMB(trimEnd - trimStart, quality, resolution)} MB
              </p>
            )}

            {/* Progress */}
            {isProcessing ? (
              <div className="space-y-1.5">
                <ProgressBar value={state.progress} />
                <p className="text-center text-xs text-ink/50">
                  {state.phase === "loading"
                    ? "FFmpeg yükleniyor..."
                    : `İşleniyor %${state.progress}`}
                </p>
              </div>
            ) : null}

            {/* Error */}
            {state.phase === "error" && state.error ? (
              <div className="rounded-xl bg-red-50 px-4 py-3">
                <p className="text-xs text-red-600">{state.error}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 text-xs font-medium text-red-700 underline"
                >
                  Tekrar dene
                </button>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="primary"
                size="md"
                loading={isProcessing}
                onClick={handleProcess}
                className="w-full"
              >
                <Scissors className="h-4 w-4" />
                {hasTrim ? "Kırp ve Yükle" : "İşle ve Yükle"}
              </Button>

              {isProcessing ? (
                <Button variant="secondary" onClick={cancel} className="w-full">
                  İptal
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={onSkip}
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Upload className="h-4 w-4" />
                  Olduğu Gibi Yükle
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
