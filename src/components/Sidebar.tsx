import { useMemo, useState } from 'react'
import { ERA_ORDER, type Facets } from '../archive'
import type { Filters, Meta } from '../types'

interface Props {
  meta: Meta
  filters: Filters
  facets: Facets
  savedCount: number
  onChange: (next: Filters) => void
  onClear: () => void
  hasFilters: boolean
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (!next.delete(value)) next.add(value)
  return next
}

export function Sidebar({ meta, filters, facets, savedCount, onChange, onClear, hasFilters }: Props) {
  const [countryQuery, setCountryQuery] = useState('')
  const [showAllCountries, setShowAllCountries] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')

  const countries = useMemo(() => {
    const all = new Set<string>([...meta.philosophers.map((p) => p.country)])
    return [...all]
      .map((name) => ({ name, count: facets.countries.get(name) ?? 0 }))
      .filter((c) => c.count > 0 || filters.countries.has(c.name))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [meta, facets.countries, filters.countries])

  const visibleCountries = countries.filter((c) => c.name.toLowerCase().includes(countryQuery.toLowerCase()))
  const shownCountries = showAllCountries || countryQuery ? visibleCountries : visibleCountries.slice(0, 12)

  const suggestions = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) return []
    return meta.philosophers.filter((p) => p.name.toLowerCase().includes(q) && !filters.philosophers.has(p.i)).slice(0, 7)
  }, [pickerQuery, meta, filters.philosophers])

  return (
    <aside className="sidebar" aria-label="Filters">
      <div className="side-top">
        <h2 className="side-title">Filters</h2>
        {hasFilters && (
          <button className="link-btn clear" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      <section className="facet">
        <h3>Saved</h3>
        <label className="check">
          <input type="checkbox" checked={filters.saved} onChange={() => onChange({ ...filters, saved: !filters.saved })} />
          <span className="check-label">Only my saved quotes</span>
          <span className="check-count">{savedCount}</span>
        </label>
      </section>

      <section className="facet">
        <h3>Category</h3>
        <ul className="check-list">
          {meta.categories.map((c, i) => (
            <li key={c.id}>
              <label className="check">
                <input type="checkbox" checked={filters.cats.has(i)} onChange={() => onChange({ ...filters, cats: toggle(filters.cats, i) })} />
                <span className="check-label">{c.name}</span>
                <span className="check-count">{facets.cats[i].toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="facet">
        <h3>Philosopher’s country</h3>
        <input className="mini-input" type="search" placeholder="Find a country…" value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} />
        <ul className="check-list">
          {shownCountries.map((c) => (
            <li key={c.name}>
              <label className="check">
                <input type="checkbox" checked={filters.countries.has(c.name)} onChange={() => onChange({ ...filters, countries: toggle(filters.countries, c.name) })} />
                <span className="check-label">{c.name}</span>
                <span className="check-count">{c.count.toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
        {!countryQuery && visibleCountries.length > 12 && (
          <button className="link-btn" onClick={() => setShowAllCountries((s) => !s)}>
            {showAllCountries ? 'Show fewer' : `Show all ${visibleCountries.length} countries`}
          </button>
        )}
      </section>

      <section className="facet">
        <h3>Era</h3>
        <ul className="check-list">
          {ERA_ORDER.filter((e) => facets.eras.has(e) || filters.eras.has(e)).map((era) => (
            <li key={era}>
              <label className="check">
                <input type="checkbox" checked={filters.eras.has(era)} onChange={() => onChange({ ...filters, eras: toggle(filters.eras, era) })} />
                <span className="check-label">{era}</span>
                <span className="check-count">{(facets.eras.get(era) ?? 0).toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="facet">
        <h3>Philosopher</h3>
        <div className="picker">
          <input className="mini-input" type="search" placeholder="Search 1,900 thinkers…" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
          {suggestions.length > 0 && (
            <ul className="suggest">
              {suggestions.map((p) => (
                <li key={p.i}>
                  <button
                    onClick={() => {
                      onChange({ ...filters, philosophers: toggle(filters.philosophers, p.i) })
                      setPickerQuery('')
                    }}
                  >
                    <span>{p.name}</span>
                    <span className="check-count">{p.country}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {filters.philosophers.size > 0 && (
          <div className="chips">
            {[...filters.philosophers].map((i) => (
              <button key={i} className="chip" onClick={() => onChange({ ...filters, philosophers: toggle(filters.philosophers, i) })}>
                {meta.philosophers[i].name} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
