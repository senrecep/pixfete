"use client"

import { useCallback, useRef, useState } from "react"

export type VideoQuality = "max" | "balanced"

export interface VideoProcessOptions {
  trimStart?: number // seconds — undefined means keep original start
  trimEnd?: number // seconds — undefined means keep original end
  quality: VideoQuality
  resolution?: "original" | "1080p" | "720p" | "480p"
}

export interface VideoProcessorState {
  phase: "idle" | "loading" | "processing" | "done" | "error"
  progress: number // 0-100
  error?: string
}

// CRF 18 = near-lossless H.264 (slightly larger file than original HEVC but
// universal browser playback). CRF 23 = default quality, smaller file.
const QUALITY: Record<VideoQuality, { crf: string; preset: string }> = {
  max: { crf: "18", preset: "medium" },
  balanced: { crf: "23", preset: "veryfast" },
}

export function useVideoProcessor() {
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null)
  const [state, setState] = useState<VideoProcessorState>({ phase: "idle", progress: 0 })

  const ensureLoaded = useCallback(async (): Promise<import("@ffmpeg/ffmpeg").FFmpeg | null> => {
    if (ffmpegRef.current) return ffmpegRef.current

    const { FFmpeg } = await import("@ffmpeg/ffmpeg").catch(() => ({ FFmpeg: null }))
    const { toBlobURL } = await import("@ffmpeg/util").catch(() => ({ toBlobURL: null }))
    if (!FFmpeg || !toBlobURL) return null

    const ff = new FFmpeg()
    ff.on("progress", ({ progress }) =>
      setState((s) => ({ ...s, progress: Math.min(99, Math.round(progress * 100)) })),
    )

    // Multi-thread WASM core — requires COOP + COEP headers on /upload (set in next.config.ts).
    const base = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm"
    const loaded = await ff
      .load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
        workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript"),
      })
      .catch(() => false as const)

    if (loaded === false) return null
    ffmpegRef.current = ff
    return ff
  }, [])

  const process = useCallback(
    async (file: File, opts: VideoProcessOptions): Promise<File | null> => {
      setState({ phase: "loading", progress: 0 })

      const ff = await ensureLoaded()
      if (!ff) {
        setState({ phase: "error", progress: 0, error: "FFmpeg yüklenemedi" })
        return null
      }

      setState({ phase: "processing", progress: 0 })

      const { fetchFile } = await import("@ffmpeg/util").catch(() => ({ fetchFile: null }))
      if (!fetchFile) {
        setState({ phase: "error", progress: 0, error: "FFmpeg util yüklenemedi" })
        return null
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mov"
      const inName = `in.${ext}`
      const outName = "out.mp4"

      const wrote = await ff
        .writeFile(inName, await fetchFile(file))
        .then(() => true)
        .catch(() => false)
      if (!wrote) {
        setState({ phase: "error", progress: 0, error: "Dosya yazılamadı" })
        return null
      }

      const args = buildArgs(inName, outName, opts)
      const ok = await ff
        .exec(args)
        .then(() => true)
        .catch(() => false)
      if (!ok) {
        setState({ phase: "error", progress: 0, error: "İşlem başarısız" })
        await ff.deleteFile(inName).catch(() => undefined)
        return null
      }

      const data = (await ff.readFile(outName).catch(() => null)) as Uint8Array | null
      await ff.deleteFile(inName).catch(() => undefined)
      await ff.deleteFile(outName).catch(() => undefined)

      if (!data) {
        setState({ phase: "error", progress: 0, error: "Çıktı dosyası okunamadı" })
        return null
      }

      const blob = new Blob([data.slice()], { type: "video/mp4" })
      const outFileName = file.name.replace(/\.[^/.]+$/, ".mp4")
      setState({ phase: "done", progress: 100 })
      return new File([blob], outFileName, { type: "video/mp4" })
    },
    [ensureLoaded],
  )

  const reset = useCallback(() => setState({ phase: "idle", progress: 0 }), [])

  const cancel = useCallback(() => {
    if (ffmpegRef.current) {
      ffmpegRef.current.terminate()
      ffmpegRef.current = null
    }
    setState({ phase: "idle", progress: 0 })
  }, [])

  return { process, state, reset, cancel }
}

function buildArgs(input: string, output: string, opts: VideoProcessOptions): string[] {
  const args: string[] = []

  // Fast seek before -i (keyframe-accurate), then -t for duration after re-encode
  if (opts.trimStart !== undefined && opts.trimStart > 0) {
    args.push("-ss", opts.trimStart.toFixed(3))
  }
  args.push("-i", input)

  if (opts.trimEnd !== undefined) {
    const duration = opts.trimEnd - (opts.trimStart ?? 0)
    if (duration > 0) args.push("-t", duration.toFixed(3))
  }

  if (opts.resolution && opts.resolution !== "original") {
    const heights: Record<string, string> = { "1080p": "1080", "720p": "720", "480p": "480" }
    const h = heights[opts.resolution]
    // scale=-2:H means auto-width (keeps aspect ratio, ensures even number)
    args.push("-vf", `scale=-2:${h}`)
  }

  const { crf, preset } = QUALITY[opts.quality]
  args.push(
    "-c:v",
    "libx264",
    "-crf",
    crf,
    "-preset",
    preset,
    "-threads",
    "0",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    output,
  )
  return args
}
