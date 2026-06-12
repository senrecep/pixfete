import { rm, stat } from "node:fs/promises"
import { isVideoMime } from "@pixfete/shared"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { photos } from "../db/schema"
import { logger } from "../logger"
import { getStorageAdapter } from "../storage"

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

// Single-flight queue: transcoding is CPU-heavy, so run one job at a time
// rather than thrashing the box when several videos finish uploading together.
let queue: Promise<void> = Promise.resolve()

/**
 * Schedules a background transcode for a freshly-uploaded local video. Produces
 * a cross-browser H.264 mp4 + JPEG poster for HEVC/.mov sources (web-friendly
 * mp4s are left as-is). Fire-and-forget: callers never await it.
 */
export function enqueueTranscode(photoId: string): void {
  queue = queue.then(() =>
    transcodeVideo(photoId).catch((err) =>
      logger.error({ photoId, err: String(err) }, "video transcode failed"),
    ),
  )
}

async function fileExists(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null)) !== null
}

async function transcodeVideo(photoId: string): Promise<void> {
  if (!(await ffmpegAvailable())) return

  const adapter = getStorageAdapter()
  // Transcoding needs the bytes on local disk; R2/GDrive uploads bypass the API.
  if (adapter.provider !== "local" || typeof adapter.resolveLocalPath !== "function") return

  const photo = db.select().from(photos).where(eq(photos.id, photoId)).limit(1).all()[0]
  if (!photo || !isVideoMime(photo.mimeType) || photo.transcodedKey) return

  const srcPath = adapter.resolveLocalPath(photo.storageKey)
  if (!(await fileExists(srcPath))) return

  // "Only what's needed": an h264 mp4 already plays everywhere — skip it.
  const codec = await videoCodec(srcPath)
  if (photo.mimeType === "video/mp4" && codec === "h264") return

  const baseKey = photo.storageKey.replace(/\.[^/.]+$/, "")
  // Avoid clobbering the original if it already ends in .mp4 (e.g. HEVC-in-mp4).
  const mp4Key = `${baseKey}.mp4` === photo.storageKey ? `${baseKey}.h264.mp4` : `${baseKey}.mp4`
  const posterKey = `${baseKey}.jpg`
  const mp4Path = adapter.resolveLocalPath(mp4Key)
  const posterPath = adapter.resolveLocalPath(posterKey)

  logger.info({ photoId, codec }, "transcoding video to h264 mp4")
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

  // Poster frame (best-effort — playback works without it).
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

  // The photo may have been deleted while we were transcoding; if so the DB
  // update referenced nothing — remove the now-orphaned derived files.
  const stillExists =
    db.select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).limit(1).all().length >
    0
  if (!stillExists) {
    await rm(mp4Path, { force: true }).catch(() => undefined)
    await rm(posterPath, { force: true }).catch(() => undefined)
    return
  }
  logger.info({ photoId, posterOk }, "video transcode complete")
}
