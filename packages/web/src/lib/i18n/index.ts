import enLocale from "./locales/en.json"
import trLocale from "./locales/tr.json"

// EN is the source of truth for the key structure; TR is checked against it.
export type Strings = typeof enLocale.strings
export type Locale = "en" | "tr"

const en: Strings = enLocale.strings
const tr: Strings = trLocale.strings
const enErrors: Record<string, string> = enLocale.errors
const trErrors: Record<string, string> = trLocale.errors

export const locales = {
  en: { strings: en, errors: enErrors },
  tr: { strings: tr, errors: trErrors },
}

/** Simple `{param}` → value interpolation for translation strings. */
export function interp(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}
