// Ready-made accent colors offered as quick presets in the admin panel. They
// are NOT a stored "theme" — picking one simply sets the accent color. Anything
// outside this list is treated as a custom color.
export const PRESET_COLORS: string[] = [
  "#9b72aa", // lavender
  "#c25b7c", // rose
  "#d98a9a", // blush
  "#7a9b76", // sage
  "#3fae97", // mint
  "#2e8b6f", // emerald
  "#1f7a8c", // ocean
  "#4a90c2", // sky
  "#e07a4f", // sunset
  "#e0695f", // coral
  "#c39a3e", // gold
  "#c2a878", // champagne
  "#c1583a", // terracotta
  "#7d4a6b", // plum
  "#8c2f44", // burgundy
  "#3a4a8c", // midnight
  "#5a6b80", // slate
  "#4a4a52", // charcoal
]

const HEX = /^#([0-9a-fA-F]{6})$/
const FALLBACK = "#9b72aa"

function toRgb(hex: string): [number, number, number] {
  const h = hex.slice(1)
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`
}

/** Linear blend of `hex` toward `target` by `amount` (0–1). */
function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = toRgb(hex)
  return toHex([
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  ])
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]

export function isPreset(color: string): boolean {
  return PRESET_COLORS.includes(color.toLowerCase())
}

/** Derives the 4 accent CSS variables from a single base accent color. */
function palette(accent: string): Record<string, string> {
  return {
    "--color-accent": accent,
    "--color-accent-light": mix(accent, WHITE, 0.35),
    "--color-accent-dark": mix(accent, BLACK, 0.2),
    "--color-accent-soft": mix(accent, WHITE, 0.9),
  }
}

/** Applies an accent color (with derived palette) to the document root. */
export function applyAccent(accentColor: string): void {
  if (typeof document === "undefined") return
  const accent = HEX.test(accentColor) ? accentColor : FALLBACK
  const root = document.documentElement
  for (const [name, value] of Object.entries(palette(accent))) {
    root.style.setProperty(name, value)
  }
}
