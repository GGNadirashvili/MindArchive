import type { Facets } from '../archive'
import { languageMode, type LanguageMode as Mode } from '../languages'
import type { Filters, Meta } from '../types'

interface Props {
  meta: Meta
  filters: Filters
  facets: Facets
  onChange: (next: Filters) => void
}

/** One-click choice between English quotes, quotes in their original language, or both. */
export function LanguageSwitch({ meta, filters, facets, onChange }: Props) {
  const originals = meta.languages.filter((l) => l !== 'en')
  const mode = languageMode(meta, filters)

  const apply = (next: Mode) => {
    const languages = next === 'all' ? new Set<string>() : next === 'en' ? new Set(['en']) : new Set(originals)
    onChange({ ...filters, languages })
  }

  const count = (codes: string[]) => codes.reduce((n, c) => n + (facets.languages.get(c) ?? 0), 0)
  const options: { mode: Mode; label: string; n: number }[] = [
    { mode: 'all', label: 'All', n: count(meta.languages) },
    { mode: 'en', label: 'English', n: count(['en']) },
    { mode: 'original', label: 'Original language', n: count(originals) },
  ]

  return (
    <div className="seg" role="group" aria-label="Quote language">
      {options.map((o) => (
        <button key={o.mode} className={mode === o.mode ? 'on' : ''} aria-pressed={mode === o.mode} onClick={() => apply(o.mode)}>
          {o.label}
          <span className="seg-count">{o.n.toLocaleString()}</span>
        </button>
      ))}
    </div>
  )
}
