import { useMemo, useState, type ReactNode } from 'react'
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

/** Collapsible section; the header shows how many values are selected. */
function Accordion({ title, selected, defaultOpen = false, children }: { title: string; selected: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`acc ${open ? 'open' : ''}`}>
      <button className="acc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="acc-title">{title}</span>
        {selected > 0 && <span className="acc-badge">{selected}</span>}
        <svg className="acc-chevron" viewBox="0 0 12 8" width="12" height="8" aria-hidden>
          <path d="m1 1.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="acc-panel">
        <div className="acc-inner">{children}</div>
      </div>
    </section>
  )
}

interface Item {
  key: string | number
  label: string
  count: number
  checked: boolean
  onToggle: () => void
}

/** Scrollable checkbox list with optional search; selected items stay pinned on top. */
function CheckList({ items, searchable, placeholder, limit = 120 }: { items: Item[]; searchable?: boolean; placeholder?: string; limit?: number }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matching = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items
  const ordered = [...matching.filter((i) => i.checked), ...matching.filter((i) => !i.checked)]
  const shown = ordered.slice(0, limit)

  return (
    <>
      {searchable && <input className="mini-input" type="search" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />}
      <ul className="check-list scroll-list">
        {shown.map((i) => (
          <li key={i.key}>
            <label className="check">
              <input type="checkbox" checked={i.checked} onChange={i.onToggle} />
              <span className="check-label">{i.label}</span>
              <span className="check-count">{i.count.toLocaleString()}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="list-empty">No matches</li>}
        {ordered.length > limit && <li className="list-empty">Showing {limit} of {ordered.length.toLocaleString()}. Type to narrow down.</li>}
      </ul>
    </>
  )
}

export function Sidebar({ meta, filters, facets, savedCount, onChange, onClear, hasFilters }: Props) {
  const categoryItems = useMemo<Item[]>(
    () =>
      meta.categories.map((c, i) => ({
        key: c.id,
        label: c.name,
        count: facets.cats[i],
        checked: filters.cats.has(i),
        onToggle: () => onChange({ ...filters, cats: toggle(filters.cats, i) }),
      })),
    [meta, facets.cats, filters, onChange],
  )

  const roleItems = useMemo<Item[]>(
    () =>
      meta.roles.map((r, i) => ({
        key: r.id,
        label: r.name,
        count: facets.roles[i],
        checked: filters.roles.has(i),
        onToggle: () => onChange({ ...filters, roles: toggle(filters.roles, i) }),
      })),
    [meta, facets.roles, filters, onChange],
  )

  const countryItems = useMemo<Item[]>(
    () =>
      [...new Set(meta.philosophers.map((p) => p.country))]
        .map((name) => ({
          key: name,
          label: name,
          count: facets.countries.get(name) ?? 0,
          checked: filters.countries.has(name),
          onToggle: () => onChange({ ...filters, countries: toggle(filters.countries, name) }),
        }))
        .filter((c) => c.count > 0 || c.checked)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [meta, facets.countries, filters, onChange],
  )

  const eraItems = useMemo<Item[]>(
    () =>
      ERA_ORDER.filter((e) => facets.eras.has(e) || filters.eras.has(e)).map((era) => ({
        key: era,
        label: era,
        count: facets.eras.get(era) ?? 0,
        checked: filters.eras.has(era),
        onToggle: () => onChange({ ...filters, eras: toggle(filters.eras, era) }),
      })),
    [facets.eras, filters, onChange],
  )

  const philosopherItems = useMemo<Item[]>(
    () =>
      meta.philosophers
        .map((p) => ({
          key: p.i,
          label: p.name,
          count: facets.philosophers.get(p.i) ?? 0,
          checked: filters.philosophers.has(p.i),
          onToggle: () => onChange({ ...filters, philosophers: toggle(filters.philosophers, p.i) }),
        }))
        // meta.philosophers is already ordered by renown
        .filter((p) => p.count > 0 || p.checked),
    [meta, facets.philosophers, filters, onChange],
  )

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

      <label className="check saved-row">
        <input type="checkbox" checked={filters.saved} onChange={() => onChange({ ...filters, saved: !filters.saved })} />
        <span className="check-label">Only my saved quotes</span>
        <span className="check-count">{savedCount}</span>
      </label>

      <Accordion title="Role" selected={filters.roles.size}>
        <CheckList items={roleItems} />
      </Accordion>

      <Accordion title="Category" selected={filters.cats.size}>
        <CheckList items={categoryItems} />
      </Accordion>

      <Accordion title="Thinker’s country" selected={filters.countries.size}>
        <CheckList items={countryItems} searchable placeholder="Find a country…" />
      </Accordion>

      <Accordion title="Thinker" selected={filters.philosophers.size}>
        <CheckList items={philosopherItems} searchable placeholder={`Search ${meta.philosophers.length.toLocaleString()} thinkers…`} />
      </Accordion>

      <Accordion title="Era" selected={filters.eras.size}>
        <CheckList items={eraItems} />
      </Accordion>
    </aside>
  )
}
