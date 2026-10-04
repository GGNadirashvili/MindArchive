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
