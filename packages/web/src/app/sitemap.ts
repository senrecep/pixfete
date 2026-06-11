import { SITE_URL } from "@/lib/event"
import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/gallery`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/upload`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/qr`, changeFrequency: "monthly", priority: 0.5 },
  ]
}
