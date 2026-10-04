import type { Filters, Meta } from './types'

/** "Georgian · ქართული": the language's English name plus its own name. */
export function languageLabel(code: string): string {
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
    const own = new Intl.DisplayNames([code], { type: 'language' }).of(code)
    return own && own.toLowerCase() !== english.toLowerCase() ? `${english} · ${own}` : english
  } catch {
    return code
  }
}

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export type LanguageMode = 'all' | 'en' | 'original'

/** Which preset the current language filter matches; null for a custom mix chosen in the sidebar. */
export function languageMode(meta: Meta, filters: Filters): LanguageMode | null {
  const originals = meta.languages.filter((l) => l !== 'en')
  const selected = filters.languages
  if (selected.size === 0) return 'all'
  if (selected.size === 1 && selected.has('en')) return 'en'
  if (selected.size === originals.length && originals.every((l) => selected.has(l))) return 'original'
  return null
}
