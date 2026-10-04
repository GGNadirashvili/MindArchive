import { emptyFilters } from './archive'
import type { Filters, Meta, SortKey } from './types'

const SORTS: SortKey[] = ['renown', 'philosopher', 'country', 'category', 'role', 'era', 'shortest', 'longest', 'shuffle']

/** Filters + sort live in the URL hash so any view can be shared or bookmarked. */
export function readHash(meta: Meta): { filters: Filters; sort: SortKey } {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const filters = emptyFilters()
  filters.query = params.get('q') ?? ''
  const catIds = (params.get('cat') ?? '').split(',').filter(Boolean)
  meta.categories.forEach((c, i) => catIds.includes(c.id) && filters.cats.add(i))
  const roleIds = (params.get('role') ?? '').split(',').filter(Boolean)
  meta.roles.forEach((r, i) => roleIds.includes(r.id) && filters.roles.add(i))
  for (const c of (params.get('country') ?? '').split('|').filter(Boolean)) filters.countries.add(c)
  for (const e of (params.get('era') ?? '').split('|').filter(Boolean)) filters.eras.add(e)
  const slugs = (params.get('by') ?? '').split(',').filter(Boolean)
  for (const p of meta.philosophers) if (slugs.includes(p.slug)) filters.philosophers.add(p.i)
  const sort = params.get('sort') as SortKey | null
  return { filters, sort: sort && SORTS.includes(sort) ? sort : 'renown' }
}

export function writeHash(meta: Meta, filters: Filters, sort: SortKey) {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.cats.size) params.set('cat', [...filters.cats].map((i) => meta.categories[i].id).join(','))
  if (filters.roles.size) params.set('role', [...filters.roles].map((i) => meta.roles[i].id).join(','))
  if (filters.countries.size) params.set('country', [...filters.countries].join('|'))
  if (filters.eras.size) params.set('era', [...filters.eras].join('|'))
  if (filters.philosophers.size) params.set('by', [...filters.philosophers].map((i) => meta.philosophers[i].slug).join(','))
  if (sort !== 'renown') params.set('sort', sort)
  const hash = params.toString()
  const url = `${window.location.pathname}${window.location.search}${hash ? '#' + hash : ''}`
  window.history.replaceState(null, '', url)
}
