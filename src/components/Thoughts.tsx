import { useEffect, useMemo, useState } from 'react'
import { PROFILE_CARDS, loadProfile, type ProfileCard } from '../content/registry'
import { ERAS, type Era, type Profile } from '../content/types'
import type { Meta, Philosopher, Quote } from '../types'

const FEATURED_QUOTES = 4
const WORDS_PER_MINUTE = 220

interface Props {
  meta: Meta
  quotes: Quote[]
  /** slug of the open profile, or null for the gallery */
  slug: string | null
  onOpen: (slug: string | null) => void
  onShowQuotes: (philosopherIndex: number) => void
}

/** Lives and ideas: a gallery of thinkers, and a reading page for each. All text opts in to word lookups. */
export default function Thoughts({ meta, quotes, slug, onOpen, onShowQuotes }: Props) {
  const bySlug = useMemo(() => new Map(meta.philosophers.map((p) => [p.slug, p])), [meta])
  // only profiles whose thinker exists in the archive (so every profile can link to quotes); already sorted by date
  const cards = useMemo(() => PROFILE_CARDS.filter((c) => bySlug.has(c.slug)), [bySlug])
  const index = slug ? cards.findIndex((c) => c.slug === slug) : -1

  if (index >= 0) {
    return (
      <ProfileLoader
        key={slug}
        slug={cards[index].slug}
        philosopher={bySlug.get(cards[index].slug)!}
        quotes={quotes}
        previous={cards[index - 1]}
        next={cards[index + 1]}
        names={bySlug}
        onOpen={onOpen}
        onShowQuotes={onShowQuotes}
      />
    )
  }
  return <Gallery cards={cards} names={bySlug} onOpen={onOpen} />
}

const nameOf = (names: Map<string, Philosopher>, slug: string) => names.get(slug)?.name ?? slug

function Gallery({ cards: profiles, names, onOpen }: { cards: ProfileCard[]; names: Map<string, Philosopher>; onOpen: (slug: string) => void }) {
  const [era, setEra] = useState<Era | 'All'>('All')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matchesQuery = (p: ProfileCard) => !q || `${nameOf(names, p.slug)} ${p.tradition} ${p.tagline} ${p.place}`.toLowerCase().includes(q)
  const shown = profiles.filter((p) => (era === 'All' || p.era === era) && matchesQuery(p))

  return (
    <div className="thoughts" data-define>
      <div className="thoughts-bar">
        <div className="seg thoughts-filter" role="group" aria-label="Era">
          {(['All', ...ERAS] as const).map((e) => (
            <button key={e} className={era === e ? 'on' : ''} aria-pressed={era === e} onClick={() => setEra(e)}>
              {e}
              <span className="seg-count">{profiles.filter((p) => (e === 'All' || p.era === e) && matchesQuery(p)).length}</span>
            </button>
          ))}
        </div>
        <input className="mini-input thoughts-search" type="search" placeholder="Search thinkers, schools, places…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search thinkers" />
      </div>

      {shown.length === 0 ? (
        <p className="map-loading">No thinker matches that search.</p>
      ) : (
        <ul className="tcards">
          {shown.map((p) => (
            <li key={p.slug}>
              <button className="tcard" onClick={() => onOpen(p.slug)}>
                <span className="tcard-meta">
                  {p.tradition} · {p.dates}
                </span>
                <span className="tcard-name">{nameOf(names, p.slug)}</span>
                <span className="tcard-tag">{p.tagline}</span>
                <span className="tcard-more">Read the story →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

function readingMinutes(p: Profile): number {
  const parts = [p.tagline, ...p.who, ...p.context, ...p.ideas.flatMap((i) => [i.title, i.text]), ...p.principles, ...p.practice, ...p.facts, ...p.myths.flatMap((m) => [m.myth, m.reality]), ...p.works.flatMap((w) => [w.title, w.note]), ...p.legacy]
  return Math.max(1, Math.round(words(parts.join(' ')) / WORDS_PER_MINUTE))
}

/** Downloads one profile (a small file holding about five profiles), then shows it. */
function ProfileLoader({ slug, ...rest }: Omit<Parameters<typeof ProfilePage>[0], 'profile'> & { slug: string }) {
  const [loaded, setLoaded] = useState<Profile | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    loadProfile(slug).then((p) => !cancelled && setLoaded(p ?? null))
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loaded === undefined) {
    return (
      <div className="thoughts profile">
        <button className="panel-back" onClick={() => rest.onOpen(null)}>
          ← All thinkers
        </button>
        <p className="map-loading">Opening the story…</p>
      </div>
    )
  }
  if (loaded === null) {
    return (
      <div className="thoughts profile">
        <button className="panel-back" onClick={() => rest.onOpen(null)}>
          ← All thinkers
        </button>
        <p className="map-loading">This profile could not be loaded. Check your connection and try again.</p>
      </div>
    )
  }
  return <ProfilePage profile={loaded} {...rest} />
}

function ProfilePage({
  profile: p,
  philosopher,
  quotes,
  previous,
  next,
  names,
  onOpen,
  onShowQuotes,
}: {
  profile: Profile
  philosopher: Philosopher
  quotes: Quote[]
  previous?: ProfileCard
  next?: ProfileCard
  names: Map<string, Philosopher>
  onOpen: (slug: string | null) => void
  onShowQuotes: (i: number) => void
}) {
  // Quotes are stored best-known first for each thinker; keep English ones for this English page.
  const own = useMemo(() => quotes.filter((q) => q.p === philosopher.i && q.lang === 'en').sort((a, b) => a.id - b.id).slice(0, FEATURED_QUOTES), [quotes, philosopher.i])
  const minutes = useMemo(() => readingMinutes(p), [p])

  const links: { label: string; href: string }[] = []
  if (philosopher.wiki) links.push({ label: 'Wikipedia', href: `https://en.wikipedia.org/wiki/${encodeURIComponent(philosopher.wiki.replace(/ /g, '_'))}` })
  if (philosopher.sep) links.push({ label: 'Stanford Encyclopedia of Philosophy', href: `https://plato.stanford.edu/entries/${philosopher.sep}/` })
  if (philosopher.iep) links.push({ label: 'Internet Encyclopedia of Philosophy', href: `https://iep.utm.edu/${philosopher.iep}/` })

  const sections = [
    { id: 'who', label: 'Life' },
    { id: 'context', label: 'World' },
    { id: 'ideas', label: 'Ideas' },
    { id: 'principles', label: 'Principles' },
    { id: 'practice', label: 'Practice' },
    { id: 'facts', label: 'Facts' },
    { id: 'myths', label: 'Myths' },
    { id: 'works', label: 'Sources' },
    { id: 'legacy', label: 'Legacy' },
    ...(own.length ? [{ id: 'words', label: 'Quotes' }] : []),
  ]
  const jump = (id: string) => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <article className="thoughts profile" data-define>
      <button className="panel-back" onClick={() => onOpen(null)}>
        ← All thinkers
      </button>

      <header className="profile-head">
        <p className="profile-meta">
          {p.era} · {p.tradition} · {p.dates}
        </p>
        <h2 className="profile-name">{philosopher.name}</h2>
        <p className="profile-place">
          {p.place} · {minutes} min read
        </p>
        <p className="profile-tagline">{p.tagline}</p>
      </header>

      <nav className="profile-toc" aria-label="In this profile">
        {sections.map((s) => (
          <button key={s.id} onClick={() => jump(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      <section id="sec-who">
        <h3 className="profile-h">Who was {philosopher.name}?</h3>
        {p.who.map((para) => (
          <p key={para.slice(0, 30)} className="profile-p">
            {para}
          </p>
        ))}
      </section>

      <section id="sec-context">
        <h3 className="profile-h">The world they lived in</h3>
        {p.context.map((para) => (
          <p key={para.slice(0, 30)} className="profile-p">
            {para}
          </p>
        ))}
      </section>

      <section id="sec-ideas">
        <h3 className="profile-h">Main ideas</h3>
        <ol className="idea-list">
          {p.ideas.map((idea) => (
            <li key={idea.title}>
              <h4>{idea.title}</h4>
              <p>{idea.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="sec-principles" className="principles">
        <h3 className="profile-h">Principles to live by</h3>
        <ul>
          {p.principles.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section id="sec-practice">
        <h3 className="profile-h">Put it into practice</h3>
        <ul className="practice-list">
          {p.practice.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section id="sec-facts">
        <h3 className="profile-h">Interesting facts</h3>
        <ul className="fact-list">
          {p.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </section>

      <section id="sec-myths">
        <h3 className="profile-h">Myths and misunderstandings</h3>
        <ul className="myth-list">
          {p.myths.map((m) => (
            <li key={m.myth}>
              <p className="myth">
                <span>Myth</span> {m.myth}
              </p>
              <p className="reality">
                <span>Reality</span> {m.reality}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section id="sec-works">
        <h3 className="profile-h">Works and sources</h3>
        <ul className="works-list">
          {p.works.map((w) => (
            <li key={w.title}>
              <strong>{w.title}</strong>
              <span>{w.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="sec-legacy">
        <h3 className="profile-h">Legacy and influence</h3>
        {p.legacy.map((para) => (
          <p key={para.slice(0, 30)} className="profile-p">
            {para}
          </p>
        ))}
      </section>

      {own.length > 0 && (
        <section id="sec-words">
          <h3 className="profile-h">In their own words</h3>
          <ul className="profile-quotes">
            {own.map((q) => (
              <li key={q.id}>
                <p>{q.text}</p>
                {q.source && <span>{q.source}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="profile-actions">
        <button className="btn-primary" onClick={() => onShowQuotes(philosopher.i)}>
          Read all {philosopher.n.toLocaleString()} quotes by {philosopher.name}
        </button>
      </div>

      <section className="profile-links">
        <h3 className="profile-h">Keep reading</h3>
        <ul>
          {links.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noreferrer noopener">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <nav className="profile-nav" aria-label="Other thinkers">
        {previous ? (
          <button onClick={() => onOpen(previous.slug)}>
            <span>← Earlier</span>
            {nameOf(names, previous.slug)}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button onClick={() => onOpen(next.slug)}>
            <span>Later →</span>
            {nameOf(names, next.slug)}
          </button>
        )}
      </nav>
    </article>
  )
}
