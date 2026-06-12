"use client"

import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/Button"
import { CopyButton } from "@/components/ui/CopyButton"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { DropZone } from "@/components/upload/DropZone"
import { FilePreview } from "@/components/upload/FilePreview"
import { type UploadItem, UploadProgress } from "@/components/upload/UploadProgress"
import { useApiError } from "@/hooks/useApiError"
import { useWakeLock } from "@/hooks/useWakeLock"
import { ApiClientError, api } from "@/lib/api"
import { SITE_URL } from "@/lib/event"
import { interp } from "@/lib/i18n"
import type { PreparedUpload } from "@/lib/types"
import { formatBytes, readMediaDimensions } from "@/lib/utils"
import { useEvent } from "@/providers/EventProvider"
import { useI18n } from "@/providers/I18nProvider"
import {
  ALLOWED_MIME_TYPES,
  type AllowedMimeType,
  CreateUploadSessionSchema,
} from "@pixfete/shared"
import { motion } from "framer-motion"
import { ArrowLeft, CheckCircle2, ExternalLink, RefreshCw, UploadCloud } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

const ALLOWED = new Set<string>(ALLOWED_MIME_TYPES)
// Persisted on the uploader's device so a return visit reuses the same session
// (and gallery) without re-deriving access from name/phone.
const TOKEN_STORAGE_KEY = "pixfete_my_token"

type Step = "identity" | "select" | "uploading" | "success"

interface SelectedFile {
  id: string
  file: File
  error?: string | undefined
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

// GDrive's resumable upload returns file metadata JSON like {"id":"...",...}.
// Extract the id without JSON.parse (R2 returns an empty body, and the project
// bans try/catch) — a regex is throw-free for both cases.
function extractDriveFileId(responseBody: string): string | undefined {
  return /"id"\s*:\s*"([^"]+)"/.exec(responseBody)?.[1]
}

function getValidationCode(file: File, maxFileSize: number): string | undefined {
  if (!ALLOWED.has(file.type)) return "Upload.InvalidMimeType"
  if (file.size > maxFileSize) return "Upload.FileTooLarge"
  return undefined
}

export default function UploadPage() {
  const { t, te } = useI18n()
  const { features, upload } = useEvent()
  const { getErrorMessage } = useApiError()

  const maxFiles = upload.maxFilesPerSession
  const maxFileSize = upload.maxFileSizeMb * 1024 * 1024

  const [step, setStep] = useState<Step>("identity")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [nameError, setNameError] = useState<string>()
  const [creatingSession, setCreatingSession] = useState(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  const [resumeChecked, setResumeChecked] = useState(false)

  const [files, setFiles] = useState<SelectedFile[]>([])
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])

  // Upload plan + completion set live in refs so the visibility handler can
  // re-drive uploads after an interruption without stale closures.
  const uploadPlanRef = useRef<Array<{ prepared: PreparedUpload; sf: SelectedFile }>>([])
  const doneRef = useRef<Set<string>>(new Set())
  const runningRef = useRef(false)
  const resumeRequestedRef = useRef(false)
  // Prevents a double-tap on the upload button from kicking off two prepare
  // calls (which would create duplicate photo rows) before the step re-renders.
  const submittingRef = useRef(false)

  // Keep the screen awake during uploads — large videos can take minutes and
  // a dimming/locking phone otherwise throttles or interrupts the transfer.
  useWakeLock(step === "uploading")

  const validFiles = useMemo(() => files.filter((f) => !f.error), [files])
  const remaining = maxFiles - files.length

  const overallProgress = useMemo(() => {
    if (uploadItems.length === 0) return 0
    const total = uploadItems.reduce((sum, item) => sum + item.progress, 0)
    return total / uploadItems.length
  }, [uploadItems])

  // On mount, resume an existing session: a `?resume=<token>` query param (e.g.
  // from the "Add Photos" button on /my/<token>) takes priority over the token
  // stored on this device. This lets a shared link keep uploading to its gallery.
  useEffect(() => {
    if (typeof window === "undefined") {
      setResumeChecked(true)
      return
    }
    const fromQuery = new URLSearchParams(window.location.search).get("resume")
    const stored = fromQuery ?? window.localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!stored) {
      setResumeChecked(true)
      return
    }
    api.upload
      .resumeSession(stored)
      .then((res) => {
        setSessionId(res.sessionId)
        setViewerToken(res.viewerToken)
        setName(res.uploaderName)
        // Remember it on this device so later visits resume automatically.
        window.localStorage.setItem(TOKEN_STORAGE_KEY, res.viewerToken)
        setStep("select")
      })
      .catch(() => {
        // Token no longer valid — drop it and fall back to the identity step.
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      })
      .finally(() => setResumeChecked(true))
  }, [])

  const switchIdentity = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setSessionId(null)
    setViewerToken(null)
    setName("")
    setPhone("")
    setNote("")
    setFiles([])
    setUploadItems([])
    setStep("identity")
  }

  const onCreateSession = async () => {
    const parsed = CreateUploadSessionSchema.safeParse({
      uploaderName: name,
      uploaderPhone: phone.trim() === "" ? null : phone.trim(),
      uploaderNote: note.trim() === "" ? null : note.trim(),
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setNameError(issue?.message ?? t.upload.identity.invalidInput)
      return
    }
    setNameError(undefined)
    setCreatingSession(true)
    try {
      const res = await api.upload.createSession({
        uploaderName: parsed.data.uploaderName,
        ...(parsed.data.uploaderPhone ? { uploaderPhone: parsed.data.uploaderPhone } : {}),
        ...(parsed.data.uploaderNote ? { uploaderNote: parsed.data.uploaderNote } : {}),
      })
      setSessionId(res.sessionId)
      setViewerToken(res.viewerToken)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, res.viewerToken)
      }
      setStep("select")
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? getErrorMessage(err) : t.upload.sessionCreateError,
      )
    } finally {
      setCreatingSession(false)
    }
  }

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => {
      const space = maxFiles - prev.length
      if (space <= 0) {
        toast.error(interp(t.upload.select.tooMany, { max: maxFiles }))
        return prev
      }
      const accepted = incoming.slice(0, space).map<SelectedFile>((file) => {
        const errCode = getValidationCode(file, maxFileSize)
        return {
          id: makeId(),
          file,
          error: errCode ? te(errCode, { max: upload.maxFileSizeMb }) : undefined,
        }
      })
      if (incoming.length > space) {
        toast.error(interp(t.upload.select.onlyNMore, { n: space }))
      }
      return [...prev, ...accepted]
    })
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const patchItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploadItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  // Uploads a single file and marks it done. Never throws — failures land as the
  // item's "error" status so a later retry/resume can pick it up.
  const uploadOne = useCallback(
    async ({ prepared, sf }: { prepared: PreparedUpload; sf: SelectedFile }) => {
      patchItem(sf.id, { status: "uploading", error: undefined })
      try {
        let driveFileId: string | undefined
        if (prepared.uploadUrl) {
          const responseBody = await api.upload.uploadToStorage(
            prepared.uploadUrl,
            prepared.uploadMethod,
            sf.file,
            (p) => patchItem(sf.id, { progress: p }),
            prepared.headers,
            prepared.fields,
          )
          driveFileId = extractDriveFileId(responseBody)
        } else {
          // Local uploads resume from the server's stored byte offset, so a
          // retry after an interruption continues instead of restarting.
          await api.upload.uploadLocalChunk(prepared.photoId, sf.file, (p) =>
            patchItem(sf.id, { progress: p }),
          )
        }
        await api.upload.complete(prepared.photoId, driveFileId)
        doneRef.current.add(sf.id)
        patchItem(sf.id, { status: "done", progress: 100 })
      } catch (err) {
        patchItem(sf.id, { status: "error", error: getErrorMessage(err) })
      }
    },
    [getErrorMessage, patchItem],
  )

  // Drives all not-yet-done items concurrently. Safe to call repeatedly (e.g. on
  // a manual retry or when the tab returns to the foreground); a single-flight
  // guard plus a resume-requested flag coalesce overlapping triggers.
  const runUploads = useCallback(async () => {
    if (runningRef.current) {
      resumeRequestedRef.current = true
      return
    }
    runningRef.current = true
    const allDone = () => uploadPlanRef.current.every((p) => doneRef.current.has(p.sf.id))
    do {
      resumeRequestedRef.current = false
      const pending = uploadPlanRef.current.filter((p) => !doneRef.current.has(p.sf.id))
      await Promise.all(pending.map(uploadOne))
    } while (
      resumeRequestedRef.current &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      !allDone()
    )
    runningRef.current = false
    if (uploadPlanRef.current.length > 0 && allDone()) {
      setStep("success")
    }
  }, [uploadOne])

  const startUpload = async () => {
    if (!sessionId || validFiles.length === 0 || submittingRef.current) return
    submittingRef.current = true
    setStep("uploading")
    doneRef.current = new Set()
    uploadPlanRef.current = []

    const withDims = await Promise.all(
      validFiles.map(async (sf) => ({
        sf,
        dims: await readMediaDimensions(sf.file),
      })),
    )

    setUploadItems(
      withDims.map(({ sf }) => ({
        id: sf.id,
        fileName: sf.file.name,
        progress: 0,
        status: "pending" as const,
      })),
    )

    try {
      const prepareRes = await api.upload.prepare({
        sessionId,
        files: withDims.map(({ sf, dims }) => ({
          fileName: sf.file.name,
          fileSize: sf.file.size,
          mimeType: sf.file.type as AllowedMimeType,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
        })),
      })

      uploadPlanRef.current = prepareRes.uploads
        .map((prepared, i) => {
          const entry = withDims[i]
          return entry ? { prepared, sf: entry.sf } : null
        })
        .filter((p): p is { prepared: PreparedUpload; sf: SelectedFile } => p !== null)

      // Prepared and now in the "uploading" step (button unmounted), so further
      // starts can only come from a later "upload more" — release the guard.
      submittingRef.current = false
      await runUploads()
    } catch (err) {
      submittingRef.current = false
      toast.error(
        err instanceof ApiClientError ? getErrorMessage(err) : t.upload.prepareFailedError,
      )
      setStep("select")
    }
  }

  // When the tab returns to the foreground mid-upload, resume anything that was
  // interrupted (the browser aborts in-flight requests while backgrounded).
  useEffect(() => {
    if (step !== "uploading") return
    const onVisible = () => {
      if (document.visibilityState === "visible") void runUploads()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [step, runUploads])

  const hasUploadErrors = uploadItems.some((it) => it.status === "error")
  const personalUrl = viewerToken ? `${SITE_URL}/my/${viewerToken}` : ""

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-5 py-12">
        {!resumeChecked ? (
          <div className="flex justify-center py-24">
            <Spinner className="h-10 w-10" />
          </div>
        ) : (
          <>
            <StepIndicator step={step} />

            {step === "identity" ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 rounded-2xl border border-accent-soft bg-white p-6 shadow-sm sm:p-8"
              >
                <h1 className="font-display text-3xl text-accent-dark">
                  {t.upload.identity.title}
                </h1>
                <p className="mt-1 text-sm text-ink/60">{t.upload.identity.subtitle}</p>
                <div className="mt-6 flex flex-col gap-4">
                  <Input
                    label={t.upload.identity.nameLabel}
                    placeholder={t.upload.identity.namePlaceholder}
                    value={name}
                    error={nameError}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCreateSession()
                    }}
                    autoFocus
                  />
                  {features.phoneField ? (
                    <Input
                      label={t.upload.identity.phoneLabel}
                      placeholder={t.upload.identity.phonePlaceholder}
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  ) : null}
                  {features.noteField ? (
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="uploader-note"
                        className="text-sm font-medium tracking-wide text-ink/80"
                      >
                        {t.upload.identity.noteLabel}
                      </label>
                      <textarea
                        id="uploader-note"
                        rows={3}
                        maxLength={500}
                        placeholder={t.upload.identity.notePlaceholder}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-xl border border-accent-light/40 bg-white px-4 py-3 text-ink placeholder:text-ink/30 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                    </div>
                  ) : null}
                  <Button
                    size="lg"
                    loading={creatingSession}
                    onClick={onCreateSession}
                    className="mt-2 w-full"
                  >
                    {t.upload.identity.continueBtn}
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {step === "select" ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex flex-col gap-5"
              >
                {viewerToken && name ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm">
                    <span className="truncate text-ink/70">
                      {interp(t.upload.resume.continueAs, { name })}
                    </span>
                    <button
                      type="button"
                      onClick={switchIdentity}
                      className="shrink-0 font-medium text-accent transition-colors hover:text-accent-dark"
                    >
                      {t.upload.resume.switchIdentity}
                    </button>
                  </div>
                ) : null}

                <DropZone onFiles={addFiles} remaining={remaining} disabled={remaining <= 0} />

                {files.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm text-ink/60">
                      <span>
                        {interp(t.upload.select.selectedInfo, {
                          valid: validFiles.length,
                          count: files.length,
                          max: maxFiles,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-accent transition-colors hover:text-accent-dark"
                      >
                        {t.upload.select.clearAll}
                      </button>
                    </div>
                    {files.map((sf) => (
                      <FilePreview
                        key={sf.id}
                        file={sf.file}
                        error={sf.error}
                        onRemove={() => removeFile(sf.id)}
                      />
                    ))}
                  </div>
                ) : null}

                <Button
                  size="lg"
                  onClick={startUpload}
                  disabled={validFiles.length === 0}
                  className="w-full"
                >
                  <UploadCloud className="h-5 w-5" />
                  {validFiles.length > 0
                    ? interp(t.upload.select.uploadBtn, { count: validFiles.length })
                    : t.upload.select.uploadBtnEmpty}
                </Button>
              </motion.div>
            ) : null}

            {step === "uploading" ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex flex-col gap-4"
              >
                <div className="rounded-2xl border border-accent-soft bg-white p-6 text-center shadow-sm">
                  <p className="font-display text-2xl text-accent-dark">
                    {t.upload.uploading.title}
                  </p>
                  <p className="mt-1 text-sm text-ink/60">
                    {interp(t.upload.uploading.progress, { pct: Math.round(overallProgress) })}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {uploadItems.map((item) => (
                    <UploadProgress key={item.id} item={item} />
                  ))}
                </div>

                {hasUploadErrors ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                    <p className="text-sm text-amber-700">{t.upload.uploading.interrupted}</p>
                    <Button variant="secondary" onClick={() => void runUploads()} className="mt-3">
                      <RefreshCw className="h-4 w-4" />
                      {t.upload.uploading.retry}
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            ) : null}

            {step === "success" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 rounded-2xl border border-accent-soft bg-white p-8 text-center shadow-sm"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-9 w-9 text-green-500" />
                </div>
                <h1 className="font-display text-3xl text-accent-dark">{t.upload.success.title}</h1>
                <p className="mt-2 text-ink/60">{t.upload.success.subtitle}</p>

                {personalUrl ? (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <div className="w-full truncate rounded-xl border border-accent-soft bg-accent-soft/40 px-4 py-3 text-sm text-accent-dark">
                      {personalUrl}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <CopyButton text={personalUrl} label={t.upload.success.copyLink} />
                      <Link
                        href={`/my/${viewerToken}`}
                        className="inline-flex items-center gap-2 rounded-full border border-accent-light/50 bg-white px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-soft"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {t.upload.success.myPhotos}
                      </Link>
                    </div>
                  </div>
                ) : null}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href="/gallery"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
                  >
                    {t.upload.success.backGallery}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles([])
                      setUploadItems([])
                      setStep("select")
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-light/50 bg-white px-6 py-3 text-sm font-medium text-accent-dark transition-colors hover:bg-accent-soft"
                  >
                    {t.upload.success.uploadMore}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === "identity" ? (
              <Link
                href="/"
                className="mt-6 inline-flex items-center gap-1.5 text-sm text-ink/50 transition-colors hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                {t.upload.identity.backHome}
              </Link>
            ) : null}
          </>
        )}
      </main>
    </>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const { t } = useI18n()
  const steps: Array<{ key: Step; label: string }> = [
    { key: "identity", label: t.upload.steps.identity },
    { key: "select", label: t.upload.steps.select },
    { key: "uploading", label: t.upload.steps.uploading },
    { key: "success", label: t.upload.steps.success },
  ]
  const activeIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                i <= activeIndex ? "bg-accent text-white" : "bg-accent-soft text-ink/40"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`hidden text-[0.6rem] tracking-wide uppercase sm:block ${
                i <= activeIndex ? "text-accent" : "text-ink/30"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <div
              className={`mb-4 h-0.5 w-6 transition-colors sm:w-10 ${
                i < activeIndex ? "bg-accent" : "bg-accent-soft"
              }`}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}
