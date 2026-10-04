import type { Filters, Meta, Quote, SortKey } from './types'

export const ERA_ORDER = ['Ancient', 'Medieval', 'Early Modern', '19th Century', 'Contemporary', 'Unknown']

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'renown', label: 'Most renowned' },
  { key: 'country', label: 'Country' },
  { key: 'category', label: 'Category' },
  { key: 'role', label: 'Role' },
  { key: 'philosopher', label: 'Thinker A–Z' },
  { key: 'era', label: 'Era (oldest first)' },
  { key: 'shortest', label: 'Shortest first' },
  { key: 'longest', label: 'Longest first' },
  { key: 'shuffle', label: 'Shuffle' },
]

export const emptyFilters = (): Filters => ({
  query: '',
  cats: new Set(),
  countries: new Set(),
  eras: new Set(),
  roles: new Set(),
  philosophers: new Set(),
  saved: false,
})

type Facet = 'cats' | 'countries' | 'eras' | 'roles' | 'philosophers' | 'saved' | 'query'

/** Does a quote pass every active filter, optionally ignoring one facet (for faceted counts)? */
export function matches(q: Quote, f: Filters, meta: Meta, saved: Set<number>, skip?: Facet): boolean {
  const ph = meta.philosophers[q.p]
  if (skip !== 'query' && f.query) {
    for (const term of f.query.toLowerCase().split(/\s+/)) if (term && !q.hay.includes(term)) return false
  }
  if (skip !== 'cats' && f.cats.size && !q.cats.some((c) => f.cats.has(c))) return false
  if (skip !== 'countries' && f.countries.size && !f.countries.has(ph.country)) return false
  if (skip !== 'eras' && f.eras.size && !f.eras.has(ph.era)) return false
  if (skip !== 'roles' && f.roles.size && !ph.roles.some((r) => f.roles.has(r))) return false
  if (skip !== 'philosophers' && f.philosophers.size && !f.philosophers.has(q.p)) return false
  if (skip !== 'saved' && f.saved && !saved.has(q.id)) return false
  return true
}

export interface Facets {
  cats: number[]
  countries: Map<string, number>
  eras: Map<string, number>
  roles: number[]
  philosophers: Map<number, number>
}

/** Counts for each facet value given all the *other* active filters. */
export function computeFacets(quotes: Quote[], f: Filters, meta: Meta, saved: Set<number>): Facets {
  const cats = new Array(meta.categories.length).fill(0)
  const countries = new Map<string, number>()
  const eras = new Map<string, number>()
  const roles = new Array(meta.roles.length).fill(0)
  const philosophers = new Map<number, number>()
  const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)

  for (const q of quotes) {
    const ph = meta.philosophers[q.p]
    if (matches(q, f, meta, saved, 'cats')) for (const c of q.cats) cats[c]++
    if (matches(q, f, meta, saved, 'countries')) bump(countries, ph.country)
    if (matches(q, f, meta, saved, 'eras')) bump(eras, ph.era)
    if (matches(q, f, meta, saved, 'roles')) for (const r of ph.roles) roles[r]++
    if (matches(q, f, meta, saved, 'philosophers')) bump(philosophers, q.p)
  }
  return { cats, countries, eras, roles, philosophers }
}

export interface Row {
  quote: Quote
  /** Heading to show above this row when sorting groups quotes (country, category...). */
  group: string | null
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sortQuotes(list: Quote[], key: SortKey, f: Filters, meta: Meta, seed: number): Row[] {
  const P = meta.philosophers
  const categoryOf = (q: Quote) => {
    const chosen = f.cats.size ? q.cats.find((c) => f.cats.has(c)) : undefined
    return meta.categories[chosen ?? q.cats[0]].name
  }
  const countryKey = (q: Quote) => (P[q.p].country === 'Unknown' ? '￿' : P[q.p].country)
  const byNumber = (a: Quote, b: Quote) => a.id - b.id

  const withGroup = (sorted: Quote[], group?: (q: Quote) => string): Row[] => {
    let last: string | null = null
    return sorted.map((quote) => {
      const g = group ? group(quote) : null
      const row = { quote, group: g !== last ? g : null }
      last = g
      return row
    })
  }

  switch (key) {
    case 'renown':
      return withGroup([...list].sort((a, b) => a.p - b.p || byNumber(a, b)))
    case 'philosopher':
      return withGroup(
        [...list].sort((a, b) => P[a.p].name.localeCompare(P[b.p].name) || byNumber(a, b)),
        (q) => P[q.p].name,
      )
    case 'country':
      return withGroup(
        [...list].sort((a, b) => countryKey(a).localeCompare(countryKey(b)) || a.p - b.p || byNumber(a, b)),
        (q) => P[q.p].country,
      )
    case 'category':
      return withGroup(
        [...list].sort((a, b) => categoryOf(a).localeCompare(categoryOf(b)) || a.p - b.p || byNumber(a, b)),
        categoryOf,
      )
    case 'role': {
      // Primary role (or the first selected role the thinker has) decides the group.
      const roleOf = (q: Quote) => {
        const roles = P[q.p].roles
        const chosen = f.roles.size ? roles.find((r) => f.roles.has(r)) : undefined
        return meta.roles[chosen ?? roles[0]].name
      }
      return withGroup(
        [...list].sort((a, b) => roleOf(a).localeCompare(roleOf(b)) || a.p - b.p || byNumber(a, b)),
        roleOf,
      )
    }
    case 'era':
      return withGroup(
        [...list].sort(
          (a, b) =>
            ERA_ORDER.indexOf(P[a.p].era) - ERA_ORDER.indexOf(P[b.p].era) ||
            (P[a.p].born ?? 0) - (P[b.p].born ?? 0) ||
            byNumber(a, b),
        ),
        (q) => P[q.p].era,
      )
    case 'shortest':
      return withGroup([...list].sort((a, b) => a.text.length - b.text.length))
    case 'longest':
      return withGroup([...list].sort((a, b) => b.text.length - a.text.length))
    case 'shuffle': {
      const rand = mulberry32(seed)
      const copy = [...list]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return withGroup(copy)
    }
  }
}

export function lifespan(born: number | null, died: number | null): string {
  const fmt = (y: number) => (y < 0 ? `${-y} BC` : `${y}`)
  if (born == null && died == null) return ''
  return `${born == null ? '?' : fmt(born)} – ${died == null ? (born != null && born > 1920 ? '' : '?') : fmt(died)}`
}
