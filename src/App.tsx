import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { SORT_OPTIONS, computeFacets, emptyFilters, matches, sortQuotes } from './archive'
import { PhilosopherModal } from './components/PhilosopherModal'
import { QuoteList } from './components/QuoteList'
import { Sidebar } from './components/Sidebar'
import { loadMeta, loadShards } from './data'
import { languageName } from './languages'
import type { Filters, Meta, Quote, SortKey } from './types'
import { readHash, writeHash, type AppView } from './urlState'

// The map (and its ~250 KB of geography data) is only downloaded when someone opens it.
const WorldMap = lazy(() => import('./components/WorldMap'))

const SAVED_KEY = 'mindarchive:saved'

function loadSaved(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sort, setSort] = useState<SortKey>('renown')
  const [seed, setSeed] = useState(1)
  const [saved, setSaved] = useState<Set<number>>(loadSaved)
  const [openPhilosopher, setOpenPhilosopher] = useState<number | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [appView, setAppView] = useState<AppView>('archive')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const m = await loadMeta()
        if (cancelled) return
        const fromUrl = readHash(m)
        setMeta(m)
        setFilters(fromUrl.filters)
        setSort(fromUrl.sort)
        setAppView(fromUrl.view)
        await loadShards(m, (shard) => !cancelled && setQuotes((prev) => [...prev, ...shard]))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the archive')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (meta) writeHash(meta, filters, sort, appView)
  }, [meta, filters, sort, appView])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]))
    } catch {
      /* storage unavailable */
    }
  }, [saved])

  const deferredFilters = useDeferredValue(filters)

  const filtered = useMemo(() => (meta ? quotes.filter((q) => matches(q, deferredFilters, meta, saved)) : []), [quotes, deferredFilters, meta, saved])
  const rows = useMemo(() => (meta ? sortQuotes(filtered, sort, deferredFilters, meta, seed) : []), [filtered, sort, deferredFilters, meta, seed])
  const facets = useMemo(() => (meta ? computeFacets(quotes, deferredFilters, meta, saved) : null), [quotes, deferredFilters, meta, saved])

  const hasFilters = filters.query !== '' || filters.cats.size > 0 || filters.countries.size > 0 || filters.eras.size > 0 || filters.roles.size > 0 || filters.schools.size > 0 || filters.languages.size > 0 || filters.philosophers.size > 0 || filters.saved

  const toggleSave = useCallback((id: number) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const addTo = useCallback(<K extends 'cats' | 'countries' | 'philosophers'>(key: K, value: K extends 'countries' ? string : number) => {
    setFilters((f) => ({ ...f, [key]: new Set([...(f[key] as Set<string | number>), value]) }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const onCategory = useCallback((i: number) => addTo('cats', i), [addTo])
  const onCountry = useCallback((c: string) => { setOpenPhilosopher(null); addTo('countries', c) }, [addTo])
  const onPhilosopher = useCallback((i: number) => setOpenPhilosopher(i), [])

  const showPhilosopherQuotes = useCallback((i: number) => {
    setFilters({ ...emptyFilters(), philosophers: new Set([i]) })
    setOpenPhilosopher(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const showThinkerFromMap = useCallback((i: number) => {
    showPhilosopherQuotes(i)
    setAppView('archive')
  }, [showPhilosopherQuotes])

  const showCountryFromMap = useCallback((country: string) => {
    setFilters({ ...emptyFilters(), countries: new Set([country]) })
    setAppView('archive')
    window.scrollTo({ top: 0 })
  }, [])

  const loading = meta !== null && quotes.length < meta.quoteCount
  const grouped = sort === 'country' || sort === 'category' || sort === 'role' || sort === 'philosopher' || sort === 'era'

  if (error) {
    return (
      <div className="boot">
        <p className="boot-title">The archive could not be opened.</p>
        <p className="boot-sub">{error}</p>
      </div>
    )
  }

  if (!meta || !facets) {
    return (
      <div className="boot">
        <div className="pulse" />
        <p className="boot-sub">Opening the archive…</p>
      </div>
    )
  }

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <div className="topbar">
            <div className="brand">
              <span className="brand-mark" aria-hidden />
              <span className="brand-name">MindArchive</span>
            </div>
            <nav className="view-nav" aria-label="Views">
              <button className={appView === 'archive' ? 'on' : ''} onClick={() => setAppView('archive')} aria-pressed={appView === 'archive'}>
                Archive
              </button>
              <button className={appView === 'map' ? 'on' : ''} onClick={() => setAppView('map')} aria-pressed={appView === 'map'}>
                World map
              </button>
            </nav>
          </div>
          {appView === 'map' ? (
            <>
              <h1 className="hero-title hero-title-map">
                Where thinkers <em>come from.</em>
              </h1>
              <p className="hero-sub">Brighter countries have more thinkers. Click a country to meet them and read their words. Scroll the page normally; use + and − or ⌘/Ctrl + scroll to zoom.</p>
            </>
          ) : (
            <>
          <h1 className="hero-title">
            The space of <em>human thought.</em>
          </h1>
          <p className="hero-sub">
            {meta.quoteCount.toLocaleString()} quotes and passages from {meta.philosophers.length.toLocaleString()} thinkers across{' '}
            {new Set(meta.philosophers.map((p) => p.country)).size} countries. Filter by topic or role, and sort by where thinkers came from.
          </p>
          <div className="searchbar">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="Search a word, a thought, a thinker…"
              aria-label="Search quotes"
            />
          </div>
            </>
          )}
        </div>
      </header>

      {appView === 'map' ? (
        <main className="wrap map-main">
          <Suspense fallback={<p className="map-loading">Drawing the world…</p>}>
            <WorldMap meta={meta} quotes={quotes} onShowThinker={showThinkerFromMap} onShowCountry={showCountryFromMap} />
          </Suspense>
        </main>
      ) : (
      <main className="wrap layout">
        <div className={`sidebar-wrap ${drawer ? 'open' : ''}`}>
          <button className="drawer-close" onClick={() => setDrawer(false)}>Done · show {filtered.length.toLocaleString()} quotes</button>
          <Sidebar
            meta={meta}
            filters={filters}
            facets={facets}
            savedCount={saved.size}
            onChange={setFilters}
            onClear={() => setFilters(emptyFilters())}
            hasFilters={hasFilters}
          />
        </div>

        <section className="results" aria-live="polite">
          <div className="toolbar">
            <button className="btn-ghost filters-toggle" onClick={() => setDrawer(true)}>
              Filters{hasFilters ? ' •' : ''}
            </button>
            <p className="result-count">
              <strong>{filtered.length.toLocaleString()}</strong> {filtered.length === 1 ? 'quote' : 'quotes'}
              {loading && <span className="loading-note"> · loading {(100 - Math.round(((meta.quoteCount - quotes.length) / meta.quoteCount) * 100))}%</span>}
            </p>
            <label className="sort">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setSeed((s) => s + 1) }}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {sort === 'shuffle' && (
              <button className="btn-ghost" onClick={() => setSeed((s) => s + 1)}>
                Reshuffle
              </button>
            )}
          </div>

          <ActiveChips meta={meta} filters={filters} onChange={setFilters} />

          {grouped && <p className="group-hint">Grouped by {sort === 'philosopher' ? 'thinker' : sort}.</p>}

          <QuoteList
            rows={rows}
            meta={meta}
            saved={saved}
            onToggleSave={toggleSave}
            onPhilosopher={onPhilosopher}
            onCategory={onCategory}
            onCountry={onCountry}
          />
        </section>
      </main>
      )}

      <footer className="footer wrap">
        <p>
          Quotes from <a href="https://www.wikiquote.org" target="_blank" rel="noreferrer noopener">Wikiquote</a> (CC BY-SA 4.0), thinker data from <a href="https://www.wikidata.org" target="_blank" rel="noreferrer noopener">Wikidata</a> (CC0), and public-domain
          passages from <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer noopener">Project Gutenberg</a>. Topics are assigned automatically and may be imperfect. Data updated {meta.generated}.
        </p>
      </footer>

      {openPhilosopher !== null && (
        <PhilosopherModal roles={meta.philosophers[openPhilosopher].roles.map((r) => meta.roles[r].name)} schools={meta.philosophers[openPhilosopher].schools.map((s) => meta.schools[s].name)} philosopher={meta.philosophers[openPhilosopher]} onClose={() => setOpenPhilosopher(null)} onShowQuotes={showPhilosopherQuotes} onCountry={onCountry} />
      )}
    </>
  )
}

function ActiveChips({ meta, filters, onChange }: { meta: Meta; filters: Filters; onChange: (f: Filters) => void }) {
  const chips: { key: string; label: string; remove: () => void }[] = []
  for (const c of filters.cats) chips.push({ key: `c${c}`, label: meta.categories[c].name, remove: () => onChange({ ...filters, cats: new Set([...filters.cats].filter((x) => x !== c)) }) })
  for (const r of filters.roles) chips.push({ key: `r${r}`, label: meta.roles[r].name, remove: () => onChange({ ...filters, roles: new Set([...filters.roles].filter((x) => x !== r)) }) })
  for (const l of filters.languages) chips.push({ key: `l${l}`, label: languageName(l), remove: () => onChange({ ...filters, languages: new Set([...filters.languages].filter((x) => x !== l)) }) })
  for (const s of filters.schools) chips.push({ key: `s${s}`, label: meta.schools[s].name, remove: () => onChange({ ...filters, schools: new Set([...filters.schools].filter((x) => x !== s)) }) })
  for (const c of filters.countries) chips.push({ key: `k${c}`, label: c, remove: () => onChange({ ...filters, countries: new Set([...filters.countries].filter((x) => x !== c)) }) })
  for (const e of filters.eras) chips.push({ key: `e${e}`, label: e, remove: () => onChange({ ...filters, eras: new Set([...filters.eras].filter((x) => x !== e)) }) })
  for (const p of filters.philosophers) chips.push({ key: `p${p}`, label: meta.philosophers[p].name, remove: () => onChange({ ...filters, philosophers: new Set([...filters.philosophers].filter((x) => x !== p)) }) })
  if (!chips.length) return null
  return (
    <div className="chips active">
      {chips.map((c) => (
        <button key={c.key} className="chip" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
          {c.label} <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  )
}
