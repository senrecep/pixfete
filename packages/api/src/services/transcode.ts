import { rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isVideoMime } from "@pixfete/shared"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { photos } from "../db/schema"
import { logger } from "../logger"
import type { StorageAdapter } from "../storage"
import { getStorageAdapter } from "../storage"

type Photo = typeof photos.$inferSelect

// Whether ffmpeg/ffprobe are usable, resolved once and cached.
let ffmpegProbe: Promise<boolean> | null = null

async function binWorks(bin: string): Promise<boolean> {
  const proc = Bun.spawn([bin, "-version"], { stdout: "ignore", stderr: "ignore" })
  return (await proc.exited) === 0
}

function ffmpegAvailable(): Promise<boolean> {
  if (!ffmpegProbe) {
    ffmpegProbe = Promise.all([
      binWorks("ffmpeg").catch(() => false),
      binWorks("ffprobe").catch(() => false),
    ]).then(([a, b]) => {
      const ok = a && b
      if (!ok) logger.warn("ffmpeg/ffprobe not found — video transcoding is disabled")
      return ok
    })
  }
  return ffmpegProbe
}

/** First video stream's codec name (e.g. "h264", "hevc"), or null. */
async function videoCodec(path: string): Promise<string | null> {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name",
      "-of",
      "default=nw=1:nk=1",
      path,
    ],
    { stdout: "pipe", stderr: "ignore" },
  )
  const out = (await new Response(proc.stdout).text()).trim()
  await proc.exited
  return out || null
}

async function fileExists(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null)) !== null
}

// Allow 2 concurrent transcodes on this 4-core ARM box — leaves headroom for
// other services while doubling throughput vs. the old serial queue.
const MAX_CONCURRENT_TRANSCODES = 2
let activeTranscodes = 0
const transcodeWaiters: Array<() => void> = []

function acquireTranscodeSlot(): Promise<void> {
  if (activeTranscodes < MAX_CONCURRENT_TRANSCODES) {
    activeTranscodes++
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => transcodeWaiters.push(resolve))
}

function releaseTranscodeSlot(): void {
  const next = transcodeWaiters.shift()
  if (next) {
    next()
  } else {
    activeTranscodes--
  }
}

/**
 * Schedules a background transcode for a freshly-uploaded video. Produces a
 * cross-browser H.264 mp4 + JPEG poster for HEVC/.mov sources. Works for all
 * storage providers (local, R2, GDrive). Fire-and-forget: callers never await it.
 */
export function enqueueTranscode(photoId: string): void {
  acquireTranscodeSlot().then(() =>
    transcodeVideo(photoId)
      .catch((err) => logger.error({ photoId, err: String(err) }, "video transcode failed"))
      .finally(() => releaseTranscodeSlot()),
  )
}

async function transcodeVideo(photoId: string): Promise<void> {
  if (!(await ffmpegAvailable())) return

  const adapter = getStorageAdapter()
  const photo = db.select().from(photos).where(eq(photos.id, photoId)).limit(1).all()[0]
  if (!photo || !isVideoMime(photo.mimeType) || photo.transcodedKey) return

  if (
    adapter.provider === "local" &&
    typeof (adapter as { resolveLocalPath?: unknown }).resolveLocalPath === "function"
  ) {
    await transcodeLocalVideo(
      photoId,
      photo,
      adapter as StorageAdapter & { resolveLocalPath: (key: string) => string },
    )
  } else if (adapter.downloadToPath && adapter.uploadFromPath) {
    await transcodeCloudVideo(photoId, photo, adapter)
  }
}

async function transcodeLocalVideo(
  photoId: string,
  photo: Photo,
  adapter: StorageAdapter & { resolveLocalPath: (key: string) => string },
): Promise<void> {
  const srcPath = adapter.resolveLocalPath(photo.storageKey)
  if (!(await fileExists(srcPath))) return

  const codec = await videoCodec(srcPath)
  if (photo.mimeType === "video/mp4" && codec === "h264") return

  const baseKey = photo.storageKey.replace(/\.[^/.]+$/, "")
  const mp4Key = `${baseKey}.mp4` === photo.storageKey ? `${baseKey}.h264.mp4` : `${baseKey}.mp4`
  const posterKey = `${baseKey}.jpg`
  const mp4Path = adapter.resolveLocalPath(mp4Key)
  const posterPath = adapter.resolveLocalPath(posterKey)

  logger.info({ photoId, codec }, "transcoding local video to h264 mp4")
  const transcode = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-i",
      srcPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-threads",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      mp4Path,
    ],
    { stdout: "ignore", stderr: "ignore" },
  )
  if ((await transcode.exited) !== 0) {
    logger.error({ photoId }, "ffmpeg exited non-zero; keeping original")
    return
  }

  const poster = Bun.spawn(
    ["ffmpeg", "-y", "-ss", "0", "-i", srcPath, "-frames:v", "1", "-q:v", "3", posterPath],
    { stdout: "ignore", stderr: "ignore" },
  )
  await poster.exited
  const posterOk = await fileExists(posterPath)

  db.update(photos)
    .set({ transcodedKey: mp4Key, posterKey: posterOk ? posterKey : null })
    .where(eq(photos.id, photoId))
    .run()

  const stillExists =
    db.select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).limit(1).all().length >
    0
  if (!stillExists) {
    await rm(mp4Path, { force: true }).catch(() => undefined)
    await rm(posterPath, { force: true }).catch(() => undefined)
  }
  logger.info({ photoId, posterOk }, "local video transcode complete")
}

async function transcodeCloudVideo(
  photoId: string,
  photo: Photo,
  adapter: StorageAdapter,
): Promise<void> {
  const { downloadToPath, uploadFromPath } = adapter
  if (!downloadToPath || !uploadFromPath) {
    logger.error({ photoId, provider: adapter.provider }, "adapter missing cloud transcode methods")
    return
  }

  const ext = photo.storageKey.split(".").pop()?.toLowerCase() ?? "bin"
  const tmp = tmpdir()
  const srcPath = join(tmp, `pixfete-${photoId}.input.${ext}`)
  const mp4Path = join(tmp, `pixfete-${photoId}.output.mp4`)
  const posterPath = join(tmp, `pixfete-${photoId}.poster.jpg`)

  const downloaded = await downloadToPath(photo.storageKey, srcPath)
  if (!downloaded) {
    logger.error({ photoId, provider: adapter.provider }, "download from storage failed")
    return
  }

  const codec = await videoCodec(srcPath)
  if (photo.mimeType === "video/mp4" && codec === "h264") {
    await rm(srcPath, { force: true }).catch(() => undefined)
    return
  }

  const baseKey = photo.storageKey.replace(/\.[^/.]+$/, "")
  const mp4DestKey =
    `${baseKey}.mp4` === photo.storageKey ? `${baseKey}.h264.mp4` : `${baseKey}.mp4`
  const posterDestKey = `${baseKey}.jpg`

  logger.info({ photoId, codec, provider: adapter.provider }, "transcoding cloud video to h264")
  const transcode = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-i",
      srcPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-threads",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      mp4Path,
    ],
    { stdout: "ignore", stderr: "ignore" },
  )
  if ((await transcode.exited) !== 0) {
    logger.error({ photoId }, "ffmpeg exited non-zero for cloud video")
    await rm(srcPath, { force: true }).catch(() => undefined)
    return
  }

  const poster = Bun.spawn(
    ["ffmpeg", "-y", "-ss", "0", "-i", srcPath, "-frames:v", "1", "-q:v", "3", posterPath],
    { stdout: "ignore", stderr: "ignore" },
  )
  await poster.exited
  const posterExists = await fileExists(posterPath)

  const finalMp4Key = await uploadFromPath(mp4DestKey, mp4Path, "video/mp4", photo.storageKey)
  const finalPosterKey = posterExists
    ? await uploadFromPath(posterDestKey, posterPath, "image/jpeg", photo.storageKey).catch(
        () => null,
      )
    : null

  await Promise.all([
    rm(srcPath, { force: true }).catch(() => undefined),
    rm(mp4Path, { force: true }).catch(() => undefined),
    rm(posterPath, { force: true }).catch(() => undefined),
  ])

  if (!finalMp4Key) {
    logger.error({ photoId, provider: adapter.provider }, "re-upload of transcoded video failed")
    return
  }

  const stillExists =
    db.select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).limit(1).all().length >
    0
  if (!stillExists) return

  db.update(photos)
    .set({ transcodedKey: finalMp4Key, posterKey: finalPosterKey })
    .where(eq(photos.id, photoId))
    .run()

  logger.info({ photoId, provider: adapter.provider }, "cloud video transcode complete")
}
