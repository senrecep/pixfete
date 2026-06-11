"use client"

import { AdminLayout } from "@/components/admin/AdminLayout"
import { LocationPicker } from "@/components/admin/LocationPicker"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { useApiError } from "@/hooks/useApiError"
import { api } from "@/lib/api"
import { PRESET_COLORS, applyAccent, isPreset } from "@/lib/theme"
import type {
  AdminSettings,
  EventType,
  Locale,
  StorageProvider,
  UpdateSettingsInput,
} from "@/lib/types"
import { useI18n } from "@/providers/I18nProvider"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const PROVIDERS: StorageProvider[] = ["local", "r2", "gdrive"]
const EVENT_TYPE_OPTIONS: EventType[] = [
  "wedding",
  "engagement",
  "birthday",
  "corporate",
  "generic",
]

// Date/time are edited as two separate fields but stored as a single ISO string
// (e.g. 2026-07-11T19:00:00+03:00). These helpers split and recombine.
function isoDatePart(iso: string): string {
  return iso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? ""
}
function isoTimePart(iso: string): string {
  return iso.match(/T(\d{2}:\d{2})/)?.[1] ?? ""
}

/** Local timezone offset as +HH:mm / -HH:mm. */
function localOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset()
  const sign = offsetMin >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, "0")
  const mm = String(abs % 60).padStart(2, "0")
  return `${sign}${hh}:${mm}`
}

/** Combine date + time parts into a stored ISO string (empty if no date). */
function combineDateTime(date: string, time: string): string {
  if (!date) return ""
  return `${date}T${time || "00:00"}:00${localOffset()}`
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { getErrorMessage } = useApiError()
  const s = t.admin.settings

  const [form, setForm] = useState<AdminSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Secret inputs are separate: empty means "keep the stored value".
  const [r2Secret, setR2Secret] = useState("")
  const [gdriveJson, setGdriveJson] = useState("")
  // Time is kept locally so the picker reflects the choice even before a date
  // is set (the combined ISO needs a date, but the UI shouldn't appear empty).
  const [timePart, setTimePart] = useState("")

  useEffect(() => {
    let active = true
    api.admin
      .getSettings()
      .then((res) => {
        if (!active) return
        setForm(res)
        setTimePart(isoTimePart(res.event.date))
      })
      .catch((err: unknown) => toast.error(getErrorMessage(err) ?? s.loadError))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [getErrorMessage, s.loadError])

  // Live preview: apply the edited theme/accent immediately (reset on navigation
  // away, since EventProvider re-applies the saved value on mount elsewhere).
  useEffect(() => {
    if (form) applyAccent(form.event.accentColor)
  }, [form])

  const save = async () => {
    if (!form) return
    setSaving(true)
    const patch: UpdateSettingsInput = {
      event: form.event,
      upload: form.upload,
      features: form.features,
      locale: form.locale,
      storage: {
        provider: form.storage.provider,
        basePath: form.storage.basePath,
        uploadsDir: form.storage.uploadsDir,
        r2: {
          endpoint: form.storage.r2.endpoint,
          accessKey: form.storage.r2.accessKey,
          bucket: form.storage.r2.bucket,
          publicUrl: form.storage.r2.publicUrl,
          ...(r2Secret ? { secretKey: r2Secret } : {}),
        },
        gdrive: {
          folderId: form.storage.gdrive.folderId,
          ...(gdriveJson ? { serviceAccountJson: gdriveJson } : {}),
        },
      },
    }
    try {
      const updated = await api.admin.updateSettings(patch)
      setForm(updated)
      setR2Secret("")
      setGdriveJson("")
      toast.success(s.saved)
    } catch (err) {
      toast.error(getErrorMessage(err) ?? s.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-accent-dark">{s.title}</h1>
          <p className="mt-1 text-sm text-ink/50">{s.subtitle}</p>
        </div>
        {form ? (
          <Button onClick={save} loading={saving}>
            {s.saveBtn}
          </Button>
        ) : null}
      </div>

      {loading || !form ? (
        <div className="flex justify-center py-24">
          <Spinner className="h-10 w-10" />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {/* Event */}
          <Section title={s.sections.event}>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="event-type" className="text-sm font-medium tracking-wide text-ink/80">
                {s.event.type}
              </label>
              <select
                id="event-type"
                value={form.event.type}
                onChange={(e) =>
                  setForm({ ...form, event: { ...form.event, type: e.target.value as EventType } })
                }
                className="h-12 w-full rounded-xl border border-accent-light/40 bg-white px-4 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {s.event.types[opt]}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={s.event.title}
              value={form.event.title}
              onChange={(e) =>
                setForm({ ...form, event: { ...form.event, title: e.target.value } })
              }
            />
            <Input
              label={s.event.subtitle}
              value={form.event.subtitle}
              onChange={(e) =>
                setForm({ ...form, event: { ...form.event, subtitle: e.target.value } })
              }
            />
            <Input
              label={s.event.date}
              type="date"
              value={isoDatePart(form.event.date)}
              onChange={(e) =>
                setForm({
                  ...form,
                  event: { ...form.event, date: combineDateTime(e.target.value, timePart) },
                })
              }
            />
            <TimeField
              label={s.event.time}
              hourLabel={s.event.hour}
              minuteLabel={s.event.minute}
              value={timePart}
              onChange={(time) => {
                setTimePart(time)
                setForm({
                  ...form,
                  event: {
                    ...form.event,
                    date: combineDateTime(isoDatePart(form.event.date), time),
                  },
                })
              }}
            />
            <Input
              label={s.event.venueName}
              value={form.event.venueName}
              onChange={(e) =>
                setForm({ ...form, event: { ...form.event, venueName: e.target.value } })
              }
            />
            <Input
              label={s.event.venueAddress}
              value={form.event.venueAddress}
              onChange={(e) =>
                setForm({ ...form, event: { ...form.event, venueAddress: e.target.value } })
              }
            />
            <LocationPicker
              value={{
                lat: form.event.lat,
                lng: form.event.lng,
                venueMapsUrl: form.event.venueMapsUrl,
              }}
              onChange={(patch) =>
                setForm({
                  ...form,
                  event: {
                    ...form.event,
                    ...(patch.lat !== undefined ? { lat: patch.lat } : {}),
                    ...(patch.lng !== undefined ? { lng: patch.lng } : {}),
                    ...(patch.venueMapsUrl !== undefined
                      ? { venueMapsUrl: patch.venueMapsUrl }
                      : {}),
                    ...(patch.venueAddress !== undefined && !form.event.venueAddress
                      ? { venueAddress: patch.venueAddress }
                      : {}),
                  },
                })
              }
            />
            <Input
              label={s.event.hostsLeft}
              value={form.event.hostsLeft}
              onChange={(e) =>
                setForm({ ...form, event: { ...form.event, hostsLeft: e.target.value } })
              }
            />
            <Input
              label={s.event.hostsRight}
              value={form.event.hostsRight}
              onChange={(e) =>
                setForm({ ...form, event: { ...form.event, hostsRight: e.target.value } })
              }
            />
            <ColorField
              label={s.event.accentColor}
              presetLabel={s.event.presetLabel}
              customLabel={s.event.customLabel}
              value={form.event.accentColor}
              onChange={(accentColor) =>
                setForm({ ...form, event: { ...form.event, accentColor } })
              }
            />

            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-ink/80">{s.event.overridesTitle}</p>
              <p className="mt-0.5 text-xs text-ink/45">{s.event.overridesHint}</p>
            </div>
            <Input
              label={s.event.overrideWelcome}
              value={form.event.overrides.welcome}
              onChange={(e) =>
                setForm({
                  ...form,
                  event: {
                    ...form.event,
                    overrides: { ...form.event.overrides, welcome: e.target.value },
                  },
                })
              }
            />
            <Input
              label={s.event.overrideGalleryTitle}
              value={form.event.overrides.galleryTitle}
              onChange={(e) =>
                setForm({
                  ...form,
                  event: {
                    ...form.event,
                    overrides: { ...form.event.overrides, galleryTitle: e.target.value },
                  },
                })
              }
            />
          </Section>

          {/* Storage */}
          <Section title={s.sections.storage}>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="storage-provider"
                className="text-sm font-medium tracking-wide text-ink/80"
              >
                {s.storage.provider}
              </label>
              <select
                id="storage-provider"
                value={form.storage.provider}
                onChange={(e) =>
                  setForm({
                    ...form,
                    storage: { ...form.storage, provider: e.target.value as StorageProvider },
                  })
                }
                className="h-12 w-full rounded-xl border border-accent-light/40 bg-white px-4 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={s.storage.basePath}
              value={form.storage.basePath}
              onChange={(e) =>
                setForm({ ...form, storage: { ...form.storage, basePath: e.target.value } })
              }
            />
            {form.storage.provider === "local" ? (
              <Input
                label={s.storage.uploadsDir}
                value={form.storage.uploadsDir}
                onChange={(e) =>
                  setForm({ ...form, storage: { ...form.storage, uploadsDir: e.target.value } })
                }
              />
            ) : null}

            {form.storage.provider === "r2" ? (
              <>
                <Input
                  label={s.storage.r2Endpoint}
                  value={form.storage.r2.endpoint}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      storage: {
                        ...form.storage,
                        r2: { ...form.storage.r2, endpoint: e.target.value },
                      },
                    })
                  }
                />
                <Input
                  label={s.storage.r2AccessKey}
                  value={form.storage.r2.accessKey}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      storage: {
                        ...form.storage,
                        r2: { ...form.storage.r2, accessKey: e.target.value },
                      },
                    })
                  }
                />
                <Input
                  label={s.storage.r2SecretKey}
                  type="password"
                  value={r2Secret}
                  placeholder={form.storage.r2.secretKeySet ? s.storage.secretSet : ""}
                  onChange={(e) => setR2Secret(e.target.value)}
                />
                <Input
                  label={s.storage.r2Bucket}
                  value={form.storage.r2.bucket}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      storage: {
                        ...form.storage,
                        r2: { ...form.storage.r2, bucket: e.target.value },
                      },
                    })
                  }
                />
                <Input
                  label={s.storage.r2PublicUrl}
                  value={form.storage.r2.publicUrl}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      storage: {
                        ...form.storage,
                        r2: { ...form.storage.r2, publicUrl: e.target.value },
                      },
                    })
                  }
                />
              </>
            ) : null}

            {form.storage.provider === "gdrive" ? (
              <>
                <Input
                  label={s.storage.gdriveFolderId}
                  value={form.storage.gdrive.folderId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      storage: {
                        ...form.storage,
                        gdrive: { ...form.storage.gdrive, folderId: e.target.value },
                      },
                    })
                  }
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="gdrive-json"
                    className="text-sm font-medium tracking-wide text-ink/80"
                  >
                    {s.storage.gdriveServiceAccount}
                  </label>
                  <textarea
                    id="gdrive-json"
                    rows={5}
                    value={gdriveJson}
                    placeholder={
                      form.storage.gdrive.serviceAccountJsonSet ? s.storage.secretSet : "{ ... }"
                    }
                    onChange={(e) => setGdriveJson(e.target.value)}
                    className="w-full rounded-xl border border-accent-light/40 bg-white px-4 py-3 font-mono text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </>
            ) : null}
          </Section>

          {/* Upload limits */}
          <Section title={s.sections.upload}>
            <Input
              label={s.upload.maxFileSizeMb}
              type="number"
              value={String(form.upload.maxFileSizeMb)}
              onChange={(e) =>
                setForm({
                  ...form,
                  upload: { ...form.upload, maxFileSizeMb: Number(e.target.value) },
                })
              }
            />
            <Input
              label={s.upload.maxFilesPerSession}
              type="number"
              value={String(form.upload.maxFilesPerSession)}
              onChange={(e) =>
                setForm({
                  ...form,
                  upload: { ...form.upload, maxFilesPerSession: Number(e.target.value) },
                })
              }
            />
            <Input
              label={s.upload.rateLimitUploadsPerHour}
              type="number"
              value={String(form.upload.rateLimitUploadsPerHour)}
              onChange={(e) =>
                setForm({
                  ...form,
                  upload: { ...form.upload, rateLimitUploadsPerHour: Number(e.target.value) },
                })
              }
            />
          </Section>

          {/* Features */}
          <Section title={s.sections.features}>
            <Toggle
              label={s.features.phoneField}
              checked={form.features.phoneField}
              onChange={(v) => setForm({ ...form, features: { ...form.features, phoneField: v } })}
            />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor="site-locale"
                className="text-sm font-medium tracking-wide text-ink/80"
              >
                {s.language.label}
              </label>
              <select
                id="site-locale"
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })}
                className="h-12 w-full rounded-xl border border-accent-light/40 bg-white px-4 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="en">{s.language.en}</option>
                <option value="tr">{s.language.tr}</option>
              </select>
              <p className="text-xs text-ink/45">{s.language.hint}</p>
            </div>
          </Section>

          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>
              {s.saveBtn}
            </Button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-accent-soft bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-display text-2xl text-ink">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function ColorField({
  label,
  presetLabel,
  customLabel,
  value,
  onChange,
}: {
  label: string
  presetLabel: string
  customLabel: string
  value: string
  onChange: (value: string) => void
}) {
  // The native color picker requires a valid #rrggbb; fall back for the swatch
  // while the text field keeps the raw stored value.
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#9b72aa"
  const preset = isPreset(value)
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <span className="text-sm font-medium tracking-wide text-ink/80">{label}</span>
      {/* Ready-made preset colors — clicking one just sets the accent color. */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => {
          const active = value.toLowerCase() === c
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={c}
              onClick={() => onChange(c)}
              style={{ backgroundColor: c }}
              className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                active ? "ring-2 ring-ink ring-offset-2" : "border border-black/10 shadow-sm"
              }`}
            />
          )
        })}
      </div>
      {/* Custom color: picker + hex. */}
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={customLabel}
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-14 cursor-pointer rounded-xl border border-accent-light/40 bg-white"
        />
        <input
          type="text"
          aria-label={customLabel}
          value={value}
          placeholder="#9b72aa"
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-40 rounded-xl border border-accent-light/40 bg-white px-4 text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <span className="text-xs text-ink/50">{preset ? presetLabel : customLabel}</span>
      </div>
    </div>
  )
}

function TimeField({
  label,
  hourLabel,
  minuteLabel,
  value,
  onChange,
}: {
  label: string
  hourLabel: string
  minuteLabel: string
  value: string
  onChange: (value: string) => void
}) {
  const [h = "", m = ""] = value.split(":")
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))
  const selectClass =
    "h-12 w-full rounded-xl border border-accent-light/40 bg-white px-4 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium tracking-wide text-ink/80">{label}</span>
      <div className="flex items-center gap-2">
        <select
          aria-label={hourLabel}
          value={h}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:${m || "00"}` : "")}
          className={selectClass}
        >
          <option value="">--</option>
          {hours.map((hh) => (
            <option key={hh} value={hh}>
              {hh}
            </option>
          ))}
        </select>
        <span className="text-ink/50">:</span>
        <select
          aria-label={minuteLabel}
          value={m}
          onChange={(e) => onChange(e.target.value ? `${h || "00"}:${e.target.value}` : "")}
          className={selectClass}
        >
          <option value="">--</option>
          {minutes.map((mm) => (
            <option key={mm} value={mm}>
              {mm}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-ink/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-accent-light/60 text-accent accent-accent"
      />
      {label}
    </label>
  )
}
