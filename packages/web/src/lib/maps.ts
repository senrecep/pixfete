// Re-exported from the shared package so the same coordinate-parsing logic is
// used by the web app and the API (server-side short-link resolution).
import { coordsFromMapUrl, coordsFromText } from "@pixfete/shared"

export { coordsFromMapUrl, coordsFromText }

export interface MapDirections {
  google: string
  apple: string
  yandex: string
}

/**
 * "Directions to destination" links for the major map providers. These are
 * https universal/app links: on mobile they open the installed native app
 * directly (Google Maps / Apple Maps / Yandex Maps) and fall back to the web
 * map otherwise — far more reliable than custom `comgooglemaps://`/`geo:`
 * schemes, which silently fail on desktop and when the app isn't installed.
 */
export function directionsUrls(lat: number, lng: number): MapDirections {
  const dest = `${lat},${lng}`
  return {
    // api=1 picks current location as the origin automatically.
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    // dirflg=d → driving directions; origin defaults to the device location.
    apple: `https://maps.apple.com/?daddr=${dest}&dirflg=d`,
    // rtext=~<dest> → route from "here" (~) to the destination; rtt=auto = by car.
    yandex: `https://yandex.com/maps/?rtext=~${dest}&rtt=auto`,
  }
}

interface VenueLike {
  lat?: number | null
  lng?: number | null
  venueMapsUrl?: string
}

/**
 * Resolve venue coordinates the same way the Hero map does: prefer the explicit
 * picker lat/lng, otherwise parse them out of the saved maps URL.
 */
export function venueCoords(event: VenueLike): { lat: number; lng: number } | null {
  if (event.lat != null && event.lng != null) return { lat: event.lat, lng: event.lng }
  return event.venueMapsUrl ? coordsFromMapUrl(event.venueMapsUrl) : null
}

/**
 * Google Maps "directions to venue" link for tappable venue labels (footer,
 * detail card). Falls back to the raw maps URL when coordinates can't be
 * resolved, so the link still points somewhere useful.
 */
export function googleDirectionsHref(event: VenueLike): string | undefined {
  const coords = venueCoords(event)
  if (coords) return directionsUrls(coords.lat, coords.lng).google
  return event.venueMapsUrl || undefined
}
