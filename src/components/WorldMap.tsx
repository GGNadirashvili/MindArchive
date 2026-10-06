import { geoNaturalEarth1, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { lifespan } from '../archive'
import { atlasName } from '../countries'
import type { Meta, Philosopher, Quote } from '../types'

const W = 960
const H = 500
const MAX_ZOOM = 14
const PREVIEW_QUOTES = 5
// Zoom level above which the detailed (50m) borders are used instead of the light 110m ones.
const DETAIL_ZOOM = 2.2

type Country = Feature<Geometry, { name: string }>
interface View {
  k: number
  x: number
  y: number
}
const HOME: View = { k: 1, x: 0, y: 0 }

interface Shape {
  name: string
  d: string
  ours: string | null
  fill: string | null
}

/**
 * The 240 country outlines. Memoised so panning, zooming and hovering (which re-render the map
 * component many times a second) never touch these elements; they only change when the selection does.
 */
const CountryPaths = memo(function CountryPaths({ shapes, selected }: { shapes: Shape[]; selected: string | null }) {
  return (
    <>
      {shapes.map((s) => (
        <path
          key={s.name}
          d={s.d}
          data-name={s.name}
          data-ours={s.ours ?? undefined}
          className={`country ${s.fill ? 'has-thinkers' : ''} ${s.ours && s.ours === selected ? 'selected' : ''}`}
          style={s.fill ? { fill: s.fill } : undefined}
        />
      ))}
    </>
  )
})

interface Props {
  meta: Meta
  quotes: Quote[]
  onShowThinker: (index: number) => void
  onShowCountry: (country: string) => void
}

export default function WorldMap({ meta, quotes, onShowThinker, onShowCountry }: Props) {
  // A light world (110m, ~10x less path data) draws first; the detailed one (50m) loads when needed.
  const [coarse, setCoarse] = useState<Country[] | null>(null)
  const [fine, setFine] = useState<Country[] | null>(null)
  const [view, setView] = useState<View>(HOME)
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null) // our country name
  const [thinker, setThinker] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null)
  // Drag updates are applied at most once per animation frame.
  const frame = useRef<number | null>(null)
  const pending = useRef<View | null>(null)

  useEffect(() => {
    let cancelled = false
    loadCountries('110m').then((c) => !cancelled && setCoarse(c))
    return () => {
      cancelled = true
    }
  }, [])

  // Detailed borders: when zoomed in or a country is open, and (on desktop) prefetched once idle.
  const needFine = view.k > DETAIL_ZOOM || selected !== null
  useEffect(() => {
    if (fine) return
    let cancelled = false
    const start = () => loadCountries('50m').then((c) => !cancelled && setFine(c))
    if (needFine) {
      start()
      return () => {
        cancelled = true
      }
    }
    if (window.innerWidth > 880 && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start)
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }
  }, [needFine, fine])

  const useFine = fine !== null && needFine
  const countries = useFine ? fine : coarse

  // Thinkers grouped by country, most renowned first (meta.philosophers is already in that order).
  const byCountry = useMemo(() => {
    const map = new Map<string, Philosopher[]>()
    for (const p of meta.philosophers) {
      if (p.country === 'Unknown') continue
      if (!map.has(p.country)) map.set(p.country, [])
      map.get(p.country)!.push(p)
    }
    return map
  }, [meta])

  const byAtlasName = useMemo(() => new Map([...byCountry.keys()].map((c) => [atlasName(c), c])), [byCountry])
  const maxThinkers = useMemo(() => Math.max(...[...byCountry.values()].map((l) => l.length)), [byCountry])

  // digits(2) keeps the path strings short, which makes them quicker to parse and draw.
  const path = useMemo(() => geoPath(geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' })).digits(2), [])

  const fillFor = useCallback(
    (name: string) => {
      const ours = byAtlasName.get(name)
      if (!ours) return null
      const t = Math.log(1 + byCountry.get(ours)!.length) / Math.log(1 + maxThinkers)
      return `rgba(43, 213, 118, ${(0.22 + 0.78 * t).toFixed(3)})`
    },
    [byAtlasName, byCountry, maxThinkers],
  )

  // Outlines are computed once, not on every render.
  const shapes = useMemo<Shape[]>(
    () =>
      (countries ?? []).map((c) => ({
        name: c.properties.name,
        d: path(c) ?? '',
        ours: byAtlasName.get(c.properties.name) ?? null,
        fill: fillFor(c.properties.name),
      })),
    [countries, path, byAtlasName, fillFor],
  )

  const zoomTo = useCallback(
    (k: number, cx: number, cy: number) => {
      const kk = Math.max(1, Math.min(MAX_ZOOM, k))
      // keep the point (cx, cy) in map coordinates fixed on screen
      setView((v) => clampView({ k: kk, x: cx - ((cx - v.x) / v.k) * kk, y: cy - ((cy - v.y) / v.k) * kk }))
    },
    [],
  )

  const focusCountry = useCallback(
    (atlas: string, extra: Country[] = []): boolean => {
      // use whichever detail level has the country (tiny countries only exist in the detailed set)
      const f = [coarse ?? [], fine ?? [], extra].flatMap((list) => list).find((c) => c.properties.name === atlas)
      if (!f) return false
      const [[x0, y0], [x1, y1]] = path.bounds(f)
      const k = Math.min(MAX_ZOOM, 0.55 / Math.max((x1 - x0) / W, (y1 - y0) / H))
      // leave room on the right for the panel on wide screens
      const targetX = window.innerWidth > 880 ? W * 0.36 : W / 2
      setView(clampView({ k, x: targetX - (k * (x0 + x1)) / 2, y: H / 2 - (k * (y0 + y1)) / 2 }))
      return true
    },
    [coarse, fine, path],
  )

  const select = (ours: string) => {
    setSelected(ours)
    setThinker(null)
    const atlas = atlasName(ours)
    if (!focusCountry(atlas)) {
      // a tiny country that only the detailed borders contain: load them, then zoom
      loadCountries('50m').then((all) => {
        setFine(all)
        focusCountry(atlas, all)
      })
    }
  }

  const close = () => {
    setSelected(null)
    setThinker(null)
    setView(HOME)
  }

  // Ctrl/⌘ + wheel (also trackpad pinch) zooms; plain scrolling still scrolls the page.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomTo(view.k * Math.exp(-e.deltaY * 0.01), ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view.k, zoomTo])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const r = svgRef.current!.getBoundingClientRect()
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 5) return
    if (!d.moved) {
      d.moved = true
      setDragging(true)
      svgRef.current!.setPointerCapture(e.pointerId)
    }
    setHover(null)
    pending.current = clampView({ k: d.view.k, x: d.view.x + (dx / r.width) * W, y: d.view.y + (dy / r.height) * H })
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        if (pending.current) setView(pending.current)
      })
    }
  }
  const onPointerUp = () => {
    setDragging(false)
    // `moved` is read by the click handler that fires right after pointerup
    setTimeout(() => (drag.current = null), 0)
  }

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
  }, [])

  // Hover/click are handled once on the group instead of on 240 separate paths.
  const onWorldMove = (e: React.PointerEvent<SVGGElement>) => {
    if (e.pointerType === 'touch' || drag.current?.moved) return
    const name = (e.target as SVGElement).dataset?.name
    if (!name) {
      setHover(null)
      return
    }
    const ours = (e.target as SVGElement).dataset.ours
    const r = svgRef.current!.getBoundingClientRect()
    setHover({ name: ours ?? name, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  const onWorldClick = (e: React.MouseEvent<SVGGElement>) => {
    if (drag.current?.moved) return
    const ours = (e.target as SVGElement).dataset?.ours
    if (ours) select(ours)
  }

  // A zoom animation re-draws the whole map every frame, which phones cannot keep up with.
  const animate = !dragging && window.innerWidth > 880

  const selectedThinkers = selected ? byCountry.get(selected) ?? [] : []
  const sortedCountries = useMemo(() => [...byCountry.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])), [byCountry])

  return (
    <div className={`map-view ${selected ? 'has-panel' : ''}`}>
      <div className="map-stage">
        {!countries && <p className="map-loading">Drawing the world…</p>}
        <svg
          ref={svgRef}
          className={`map-svg ${dragging ? 'dragging' : ''}`}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="World map of countries by number of thinkers. Use the country list to browse with the keyboard."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          <g
            className="map-world"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
              transition: animate ? undefined : 'none',
              // thin borders that stay thin when zoomed, without the (slow) non-scaling-stroke mode
              strokeWidth: 0.5 / view.k,
              '--k': view.k,
            } as CSSProperties}
            onPointerMove={onWorldMove}
            onClick={onWorldClick}
          >
            <CountryPaths shapes={shapes} selected={selected} />
          </g>
        </svg>

        {hover && (
          <div className="map-tip" style={{ left: hover.x, top: hover.y }}>
            <strong>{hover.name}</strong>
            <span>{byCountry.has(hover.name) ? `${byCountry.get(hover.name)!.length} thinkers` : 'No thinkers yet'}</span>
          </div>
        )}

        <div className="map-controls">
          <button onClick={() => zoomTo(view.k * 1.6, W / 2, H / 2)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomTo(view.k / 1.6, W / 2, H / 2)} aria-label="Zoom out">−</button>
          <button onClick={() => setView(HOME)} aria-label="Reset view">⟲</button>
        </div>

        <div className="map-legend" aria-hidden>
          <span>Fewer</span>
          <span className="legend-bar" />
          <span>More thinkers</span>
        </div>

        {selected && (
          <aside className="map-panel" aria-label={`Thinkers from ${selected}`}>
            <button className="panel-close" onClick={close} aria-label="Close panel">×</button>
            {thinker === null ? (
              <CountryList country={selected} thinkers={selectedThinkers} meta={meta} onPick={setThinker} onShowCountry={onShowCountry} />
            ) : (
              <ThinkerDetail philosopher={meta.philosophers[thinker]} meta={meta} quotes={quotes} onBack={() => setThinker(null)} onShowThinker={onShowThinker} />
            )}
          </aside>
        )}
      </div>

      <section className="map-list" aria-label="Browse countries">
        <h2 className="map-list-title">All countries</h2>
        <ul>
          {sortedCountries.map(([name, list]) => (
            <li key={name}>
              <button className={name === selected ? 'on' : ''} onClick={() => select(name)}>
                <span>{name}</span>
                <span className="check-count">{list.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Loads and converts one resolution of the world-atlas country borders. */
async function loadCountries(resolution: '110m' | '50m'): Promise<Country[]> {
  const mod = resolution === '110m' ? await import('world-atlas/countries-110m.json') : await import('world-atlas/countries-50m.json')
  const topology = (mod.default ?? mod) as unknown as Topology
  const fc = feature(topology, topology.objects.countries as GeometryCollection<{ name: string }>) as FeatureCollection<Geometry, { name: string }>
  return fc.features.filter((f) => f.properties.name !== 'Antarctica')
}

function clampView(v: View): View {
  // keep the map from being dragged completely out of frame
  const minX = W - W * v.k
  const minY = H - H * v.k
  return { k: v.k, x: Math.min(W * 0.25, Math.max(minX - W * 0.25, v.x)), y: Math.min(H * 0.25, Math.max(minY - H * 0.25, v.y)) }
}

function CountryList({ country, thinkers, meta, onPick, onShowCountry }: { country: string; thinkers: Philosopher[]; meta: Meta; onPick: (i: number) => void; onShowCountry: (c: string) => void }) {
  const total = thinkers.reduce((n, p) => n + p.n, 0)
  return (
    <>
      <h2 className="panel-title">{country}</h2>
      <p className="panel-sub">
        {thinkers.length} {thinkers.length === 1 ? 'thinker' : 'thinkers'} · {total.toLocaleString()} quotes
      </p>
      <button className="btn-primary panel-cta" onClick={() => onShowCountry(country)}>
        Browse all quotes from {country}
      </button>
      <ul className="panel-list">
        {thinkers.map((p) => (
          <li key={p.i}>
            <button onClick={() => onPick(p.i)}>
              <span className="panel-name">{p.name}</span>
              <span className="panel-meta">
                {meta.roles[p.roles[0]].name}
                {lifespan(p.born, p.died) && ` · ${lifespan(p.born, p.died)}`}
              </span>
              <span className="check-count">{p.n}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function ThinkerDetail({ philosopher: p, meta, quotes, onBack, onShowThinker }: { philosopher: Philosopher; meta: Meta; quotes: Quote[]; onBack: () => void; onShowThinker: (i: number) => void }) {
  // Quotes are stored best-known first for each thinker, so the first few make a good preview.
  const preview = useMemo(() => quotes.filter((q) => q.p === p.i).sort((a, b) => a.id - b.id).slice(0, PREVIEW_QUOTES), [quotes, p.i])
  return (
    <>
      <button className="panel-back" onClick={onBack}>← {p.country}</button>
      <h2 className="panel-title">{p.name}</h2>
      <p className="panel-sub">
        {meta.roles[p.roles[0]].name}
        {lifespan(p.born, p.died) && ` · ${lifespan(p.born, p.died)}`}
      </p>
      {p.desc && <p className="panel-desc">{p.desc}</p>}
      <ul className="panel-quotes">
        {preview.map((q) => (
          <li key={q.id}>
            <p className="pq-text" lang={q.lang} translate={q.lang !== 'en' ? 'no' : undefined} data-define={q.lang === 'en' ? '' : undefined}>{q.text}</p>
            {q.orig && (
              <p className="pq-orig">
                {q.orig}
              </p>
            )}
            {q.source && <p className="pq-src">{q.source}</p>}
          </li>
        ))}
        {preview.length === 0 && <li className="pq-src">Quotes are still loading…</li>}
      </ul>
      <button className="btn-primary panel-cta" onClick={() => onShowThinker(p.i)}>
        Show all {p.n.toLocaleString()} quotes
      </button>
    </>
  )
}
