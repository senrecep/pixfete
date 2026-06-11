import type { EventConfig } from "@pixfete/shared"

// Neutral fallback for SSR / when the API is unreachable. Real content is
// admin-managed and arrives from /api/event; only operational defaults are set.
export const DEFAULT_EVENT: EventConfig = {
  type: "wedding",
  title: "",
  subtitle: "",
  date: "",
  venueName: "",
  venueAddress: "",
  venueMapsUrl: "",
  lat: null,
  lng: null,
  hostsLeft: "",
  hostsRight: "",
  accentColor: "#9b72aa",
  overrides: { welcome: "", galleryTitle: "" },
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
