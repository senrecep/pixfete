// Extracts coordinates from a Google Maps / OpenStreetMap URL. Shared so both
// the web app (client-side) and the API (server-side short-link resolution) use
// the same logic. Returns null if no coordinates are present.

function valid(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function coordsFromMapUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null

  // Google Maps "@lat,lng,zoom"
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at) return valid(Number(at[1]), Number(at[2]))

  // Google Maps place "!3dLAT!4dLNG"
  const place = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (place) return valid(Number(place[1]), Number(place[2]))

  // OpenStreetMap "#map=zoom/lat/lng"
  const osm = url.match(/#map=[\d.]+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/)
  if (osm) return valid(Number(osm[1]), Number(osm[2]))

  // Query params (?q=lat,lng, ?mlat=&mlon=, ?lat=&lon=, ?ll=lat,lng …)
  try {
    const p = new URL(url).searchParams
    const mlat = p.get("mlat")
    const mlon = p.get("mlon")
    if (mlat && mlon) return valid(Number(mlat), Number(mlon))

    const plat = p.get("lat")
    const plon = p.get("lon") ?? p.get("lng")
    if (plat && plon) return valid(Number(plat), Number(plon))

    for (const key of ["q", "query", "ll", "center", "destination", "daddr"]) {
      const v = p.get(key)
      const pair = v?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
      if (pair) return valid(Number(pair[1]), Number(pair[2]))
    }
  } catch {
    // Not a parseable absolute URL — ignore.
  }
  return null
}

/** Looser scan for coordinates embedded in arbitrary text (e.g. a Maps HTML page). */
export function coordsFromText(text: string): { lat: number; lng: number } | null {
  // Patterns like "/@41.13,28.82" or "[null,null,41.13,28.82]" in Google pages.
  const at = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (at) return valid(Number(at[1]), Number(at[2]))
  const arr = text.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/)
  if (arr) return valid(Number(arr[1]), Number(arr[2]))
  return null
}
