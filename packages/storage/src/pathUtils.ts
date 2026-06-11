const TR_MAP: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
  ç: "c", Ç: "c", ö: "o", Ö: "o", ü: "u", Ü: "u",
}

/**
 * Converts an uploader name into a URL/path-safe slug.
 * "Ahmet Yılmaz" → "ahmet-yilmaz"
 * "İbrahim Öztürk" → "ibrahim-ozturk"
 */
export function nameToSlug(name: string): string {
  return name
    .split("")
    .map((c) => TR_MAP[c] ?? c)
    .join("")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "uploader"
}

/** Sanitizes a file name to prevent path traversal. */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/\0/g, "")
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^\./, "_")
    .slice(0, 255)
}
