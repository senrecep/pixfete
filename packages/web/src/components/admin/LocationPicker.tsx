"use client"

import { api } from "@/lib/api"
import { coordsFromMapUrl } from "@/lib/maps"
import { useI18n } from "@/providers/I18nProvider"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-accent-soft" />,
})

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

interface LocationValue {
  lat: number | null
  lng: number | null
  venueMapsUrl: string
}

interface LocationPickerProps {
  value: LocationValue
  onChange: (patch: Partial<LocationValue> & { venueAddress?: string }) => void
}

const inputClass =
  "h-12 w-full rounded-xl border border-accent-light/40 bg-white px-4 text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useI18n()
  const l = t.admin.settings.location
  const hasCoords = value.lat != null && value.lng != null

  const [mode, setMode] = useState<"map" | "url">(hasCoords || !value.venueMapsUrl ? "map" : "url")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [resolving, setResolving] = useState(false)
  const justPicked = useRef(false)
  const resolveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const resolveAbort = useRef<AbortController>(undefined)

  // URL mode: store the URL + any client-parsable coords immediately, then ask
  // the server to resolve short links (maps.app.goo.gl) that need a redirect.
  const onUrlChange = (url: string) => {
    const c = coordsFromMapUrl(url)
    onChange({ venueMapsUrl: url, lat: c?.lat ?? null, lng: c?.lng ?? null })
    clearTimeout(resolveTimer.current)
    resolveAbort.current?.abort()
    if (c || !/^https?:\/\//i.test(url)) {
      setResolving(false)
      return
    }
    setResolving(true)
    const controller = new AbortController()
    resolveAbort.current = controller
    resolveTimer.current = setTimeout(async () => {
      try {
        const r = await api.admin.resolveLocation(url)
        if (!controller.signal.aborted && r.lat != null && r.lng != null) {
          onChange({ lat: r.lat, lng: r.lng })
        }
      } catch {
        // ignore — leave as no-coords
      } finally {
        if (!controller.signal.aborted) setResolving(false)
      }
    }, 700)
  }

  // Debounced live search: query the geocoder ~600ms after typing stops, and
  // abort any in-flight request so out-of-order responses don't win.
  useEffect(() => {
    const q = query.trim()
    if (justPicked.current) {
      justPicked.current = false
      return
    }
    if (q.length < 3) {
      setResults([])
      setSearched(false)
      setSearching(false)
      return
    }
    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=tr&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" }, signal: controller.signal },
        )
        setResults((await res.json()) as NominatimResult[])
        setSearched(true)
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
          setSearched(true)
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 600)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const pick = (r: NominatimResult) => {
    justPicked.current = true
    onChange({ lat: Number(r.lat), lng: Number(r.lon), venueAddress: r.display_name })
    setResults([])
    setSearched(false)
    setQuery(r.display_name.split(",")[0] ?? "")
  }

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium tracking-wide text-ink/80">{l.label}</span>
        <div className="flex gap-1 rounded-full bg-accent-soft p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("map")}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              mode === "map" ? "bg-accent text-white" : "text-ink/60"
            }`}
          >
            {l.modeMap}
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              mode === "url" ? "bg-accent text-white" : "text-ink/60"
            }`}
          >
            {l.modeUrl}
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <>
          <input
            type="text"
            aria-label={l.modeUrl}
            value={value.venueMapsUrl}
            placeholder="https://maps.google.com/?q=... · maps.app.goo.gl/... · openstreetmap.org/#map=..."
            onChange={(e) => onUrlChange(e.target.value)}
            className={inputClass}
          />
          {hasCoords ? (
            <div className="h-64 w-full overflow-hidden rounded-xl border border-accent-soft">
              <LeafletMap lat={value.lat as number} lng={value.lng as number} />
            </div>
          ) : resolving ? (
            <p className="flex items-center gap-2 text-xs text-ink/50">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              {l.resolving}
            </p>
          ) : value.venueMapsUrl ? (
            <p className="text-xs text-amber-600">{l.urlNoCoords}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-xs text-ink/45">{l.hint}</p>
          <div className="relative">
            <input
              type="text"
              aria-label={l.searchPlaceholder}
              value={query}
              placeholder={l.searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
              className={`${inputClass} pr-10`}
            />
            {searching ? (
              <span className="-translate-y-1/2 absolute top-1/2 right-3 h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            ) : null}
            {results.length > 0 ? (
              <ul className="absolute z-[1000] mt-1 flex w-full flex-col gap-1 rounded-xl border border-accent-soft bg-white p-1 shadow-lg">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lon}`}>
                    <button
                      type="button"
                      onClick={() => pick(r)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink/80 transition-colors hover:bg-accent-soft"
                    >
                      {r.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {searched && !searching && results.length === 0 ? (
              <p className="mt-1 text-sm text-ink/40">{l.noResults}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={value.lat ?? ""}
              placeholder={l.lat}
              onChange={(e) =>
                onChange({ lat: e.target.value === "" ? null : Number(e.target.value) })
              }
              className={inputClass}
              aria-label={l.lat}
            />
            <input
              type="number"
              step="any"
              value={value.lng ?? ""}
              placeholder={l.lng}
              onChange={(e) =>
                onChange({ lng: e.target.value === "" ? null : Number(e.target.value) })
              }
              className={inputClass}
              aria-label={l.lng}
            />
          </div>

          {hasCoords ? (
            <div className="overflow-hidden rounded-xl border border-accent-soft">
              <div className="h-64 w-full">
                <LeafletMap
                  lat={value.lat as number}
                  lng={value.lng as number}
                  scrollWheelZoom
                  onPick={(lat, lng) => onChange({ lat, lng })}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange({ lat: null, lng: null })}
                className="w-full bg-accent-soft/50 py-2 text-xs text-accent-dark transition-colors hover:bg-accent-soft"
              >
                {l.clear}
              </button>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-accent-light/50 text-sm text-ink/40">
              {l.empty}
            </div>
          )}
        </>
      )}
    </div>
  )
}
