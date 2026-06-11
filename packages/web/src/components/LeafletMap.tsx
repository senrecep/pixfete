"use client"

import { directionsUrls } from "@/lib/maps"
import { useI18n } from "@/providers/I18nProvider"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Navigation } from "lucide-react"
import { useEffect } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet"

// Teardrop pin styled with the current accent color (matches the site theme).
// popupAnchor lifts the directions popup so it floats just above the pin's tip.
const pin = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:var(--color-accent);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);transform:rotate(-45deg)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
  popupAnchor: [0, -22],
})

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], zoom)
  }, [lat, lng, zoom, map])
  return null
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

interface LeafletMapProps {
  lat: number
  lng: number
  zoom?: number
  scrollWheelZoom?: boolean
  onPick?: (lat: number, lng: number) => void
  /** Shown as the popup heading in display mode (e.g. the venue name). */
  venueName?: string
}

export default function LeafletMap({
  lat,
  lng,
  zoom = 15,
  scrollWheelZoom = false,
  onPick,
  venueName,
}: LeafletMapProps) {
  const { t } = useI18n()
  const dir = directionsUrls(lat, lng)
  // Brand names stay literal; only the heading is localized.
  const providers = [
    { label: t.directions.google, url: dir.google },
    { label: t.directions.apple, url: dir.apple },
    { label: t.directions.yandex, url: dir.yandex },
  ]

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={pin}>
        {/* In picker mode (onPick) the pin is just a position indicator; in
            display mode it opens a directions popup with one-tap deep links. */}
        {onPick ? null : (
          <Popup>
            <div className="min-w-[190px]">
              {venueName ? (
                <p className="mb-1 font-display text-base text-ink">{venueName}</p>
              ) : null}
              <p className="mb-2 text-[0.7rem] font-medium tracking-widest text-ink/50 uppercase">
                {t.directions.title}
              </p>
              <div className="flex flex-col gap-1.5">
                {providers.map((p) => (
                  <a
                    key={p.url}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-accent-light/50 bg-white px-3 py-2 text-sm font-medium text-accent-dark no-underline transition-colors hover:bg-accent-soft"
                  >
                    <Navigation className="h-4 w-4 shrink-0 text-accent" />
                    {p.label}
                  </a>
                ))}
              </div>
            </div>
          </Popup>
        )}
      </Marker>
      <Recenter lat={lat} lng={lng} zoom={zoom} />
      {onPick ? <ClickHandler onPick={onPick} /> : null}
    </MapContainer>
  )
}
