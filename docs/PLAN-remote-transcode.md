# Plan — Remote Storage Video Transcode (R2 / Google Drive)

> Status: **proposed** · Scope: extend the existing background video transcode so it also works when storage is Cloudflare R2 or Google Drive (currently **local-only**).

## 1. Background & current state

iPhone videos are HEVC in a `.mov` container. Outside Safari, browsers can't decode them inline, so the gallery `<video>` falls back to the "preview unavailable" placeholder.

A background transcode (HEVC/`.mov` → H.264 `.mp4` + JPEG poster) already exists for **local** storage:

- `packages/api/src/services/transcode.ts` — single-flight queue, `ffmpeg`/`ffprobe`, reads the original straight off local disk via `resolveLocalPath`, writes the derived files next to it, then sets `photos.transcoded_key` / `photos.poster_key`.
- Trigger: `POST /api/upload/complete` → `enqueueTranscode(photoId)` (fire-and-forget) when `provider === "local"` and the mime is a video.
- Serving: `/api/uploads/*` matches `storageKey | transcodedKey | posterKey` with identical auth; web `videoSrc()` / `posterSrc()` prefer the derived files.

**Why R2/GDrive are skipped today:** the client uploads directly to the bucket (R2 presigned PUT / GDrive resumable session), so the bytes never touch the API host. `transcodeVideo` early-returns for any non-local provider.

```ts
if (adapter.provider !== "local" || typeof adapter.resolveLocalPath !== "function") return
```

Result on R2/GDrive: video is stored and downloadable, Safari plays it, other browsers show the fallback (+ WhatsApp/download). No transcode.

## 2. Goal

When storage is R2 or GDrive, the same upload→complete→background flow produces a web-friendly `.mp4` + poster and serves them, so videos play in every browser — without changing the upload UX.

Non-goals: client-side transcode, live/streaming transcode, changing the local path (already works), HLS/multi-resolution.

## 3. Design

Local does disk→disk. Remote needs **download → ffmpeg → re-upload**:

```
complete → enqueueTranscode(photoId)
  └─ job:
     1. download original from bucket → OS temp file
     2. ffprobe codec; skip if already h264 mp4
     3. ffmpeg → temp .mp4 (+ .jpg poster)
     4. upload .mp4 + .jpg back to bucket (server-side PUT)
     5. set photos.transcoded_key / poster_key
     6. delete temp files (always); if photo was deleted mid-job, delete the
        re-uploaded derivatives too
```

The original is **never overwritten** — derived objects get their own keys, exactly like local.

### 3.1 StorageAdapter extensions (`packages/api/src/storage.ts`)

The adapter interface needs two server-side capabilities the presigned flow never required:

| Method | Purpose | R2 | GDrive |
|---|---|---|---|
| `getObjectStream(key)` (or reuse `fetchObject`) | download original to temp | S3 `GetObject` (creds already configured) | already implemented (`fetchObject`) |
| `putObject(key, filePath, contentType)` | upload derived files server-side | S3 `PutObject` (creds present) | Drive resumable/multipart via service account |

- **R2:** both are straightforward — the adapter already holds `endpoint`/`accessKey`/`secretKey`/`bucket`; add S3 GET + PUT (aws4fetch or the existing S3 client path used for presigning).
- **GDrive:** `fetchObject` exists for download; add an upload via the service-account Drive API (`files.create`, multipart) returning the new file id as the key.

Keep these methods **optional** on the interface; `transcodeVideo` checks for them and no-ops if missing (same defensive pattern as `resolveLocalPath`).

### 3.2 Transcode service changes

Generalize `transcodeVideo`:

- Replace the local-only guard with: resolve a readable source.
  - local → `resolveLocalPath` (no temp copy).
  - remote → `getObjectStream(storageKey)` → write to `os.tmpdir()/pixfete-<photoId>.<ext>`.
- ffprobe + ffmpeg run on the local/temp path (unchanged).
- Output: local writes in place; remote writes to temp then `putObject` to derived keys.
- Derived keys:
  - local: ext-swap of `storageKey` (current).
  - R2: same convention (`{slug}/{photoId}.mp4`, `.jpg`) under the bucket prefix.
  - GDrive: keys are file ids → store the ids returned by `putObject`.
- `finally`: remove every temp file. Keep the existing "photo deleted mid-job → delete derivatives" guard, extended to call `adapter.deleteFile` for remote.

### 3.3 Serving & web

Mostly already done:

- Serve route already matches transcoded/poster keys. For **R2 public** buckets the derived `.mp4`/poster should be served by public URL (set `photos.publicUrl`-style for the derived, or have `videoSrc`/`posterSrc` build the R2 public URL from the key). For **GDrive** they stream through the existing `/api/uploads` proxy (`fetchObject` by id) — no change.
- `videoSrc()` / `posterSrc()` (web `lib/photo.ts`) currently build `/api/uploads/<key>` proxy URLs. For R2-public derived files, prefer the public URL. Add a small branch (or store derived `publicUrl`).

### 3.4 Config / limits

- Concurrency stays single-flight (1 job) to bound CPU.
- Add an optional cap: skip transcode above N MB to avoid huge egress (admin setting, default e.g. 1–2 GB). Optional.
- Temp dir must have space for the largest video; document in DEPLOYMENT.md.

## 4. Cost & trade-offs

- **Bandwidth/egress:** each remote video is downloaded to the API host and the derivative uploaded back. R2 egress to the worker region is cheap/free within Cloudflare; GDrive API quota applies.
- **Disk:** transient temp files (original + mp4) — sized to the largest upload.
- **Latency:** transcode now includes network transfer on both ends; still background, user unaffected.

## 5. Tasks (suggested order)

1. **Adapter — R2:** add `getObjectStream` + `putObject` (S3 GET/PUT). Unit-check against a test bucket.
2. **Adapter — GDrive:** add `putObject` (service-account upload); reuse `fetchObject` for download.
3. **transcode.ts:** generalize source resolution (local path vs temp download) + output (in-place vs putObject) + temp cleanup; extend the deleted-mid-job guard for remote.
4. **Trigger:** drop the `provider === "local"` restriction in `/complete` (gate instead on "adapter supports get+put OR is local").
5. **Serving/web:** derived URL resolution for R2 public; verify GDrive proxy path.
6. **Settings (optional):** max-transcode-size cap.
7. **Docs:** update DEPLOYMENT.md (ffmpeg already required; note temp-dir/egress for remote).

## 6. Testing / verification

- Local regression: existing local transcode still works (no behavior change).
- R2: upload HEVC `.mov` → confirm derived `.mp4` + poster appear in bucket, DB keys set, gallery plays in Chrome.
- GDrive: same via proxy.
- Failure paths: ffmpeg missing → no-op; download/upload failure → original preserved, no DB change; photo deleted mid-job → no orphaned remote objects.
- `bun run typecheck` + `biome check` clean; no new `try/catch` in API (use `Result`/`.catch`).

## 7. Open questions

- Which backend is actually targeted (the live deployment currently appears to use **local**)? If staying local, this plan is optional.
- R2 bucket public vs proxied — affects derived URL resolution (§3.3).
- Acceptable max video size for remote transcode (egress guardrail)?
