import { useMemo, useState } from 'react'
import { ANCIENT, TRADITIONS, type Profile, type Tradition } from '../content/ancient'
import type { Meta, Philosopher, Quote } from '../types'

const FEATURED_QUOTES = 4

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
  const profiles = useMemo(() => [...ANCIENT].sort((a, b) => a.order - b.order), [])
  const current = slug ? profiles.find((p) => p.slug === slug) : undefined

  if (current && bySlug.get(current.slug)) {
    const index = profiles.indexOf(current)
    return (
      <ProfilePage
        profile={current}
        philosopher={bySlug.get(current.slug)!}
        quotes={quotes}
        previous={profiles[index - 1]}
        next={profiles[index + 1]}
        names={bySlug}
        onOpen={onOpen}
        onShowQuotes={onShowQuotes}
      />
    )
  }
  return <Gallery profiles={profiles} names={bySlug} onOpen={onOpen} />
}

function Gallery({ profiles, names, onOpen }: { profiles: Profile[]; names: Map<string, Philosopher>; onOpen: (slug: string) => void }) {
  const [tradition, setTradition] = useState<Tradition | 'All'>('All')
  const shown = tradition === 'All' ? profiles : profiles.filter((p) => p.tradition === tradition)

  return (
    <div className="thoughts" data-define>
      <div className="seg thoughts-filter" role="group" aria-label="Tradition">
        {(['All', ...TRADITIONS] as const).map((t) => (
          <button key={t} className={tradition === t ? 'on' : ''} aria-pressed={tradition === t} onClick={() => setTradition(t)}>
            {t}
            <span className="seg-count">{t === 'All' ? profiles.length : profiles.filter((p) => p.tradition === t).length}</span>
          </button>
        ))}
      </div>

      <ul className="tcards">
        {shown.map((p) => (
          <li key={p.slug}>
            <button className="tcard" onClick={() => onOpen(p.slug)}>
              <span className="tcard-meta">
                {p.tradition} · {p.dates}
              </span>
              <span className="tcard-name">{names.get(p.slug)?.name ?? p.slug}</span>
              <span className="tcard-tag">{p.tagline}</span>
              <span className="tcard-more">Read the story →</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
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
  previous?: Profile
  next?: Profile
  names: Map<string, Philosopher>
  onOpen: (slug: string | null) => void
  onShowQuotes: (i: number) => void
}) {
  // Quotes are stored best-known first for each thinker; keep English ones for this English page.
  const own = useMemo(() => quotes.filter((q) => q.p === philosopher.i && q.lang === 'en').sort((a, b) => a.id - b.id).slice(0, FEATURED_QUOTES), [quotes, philosopher.i])

  const links: { label: string; href: string }[] = []
  if (philosopher.wiki) links.push({ label: 'Wikipedia', href: `https://en.wikipedia.org/wiki/${encodeURIComponent(philosopher.wiki.replace(/ /g, '_'))}` })
  if (philosopher.sep) links.push({ label: 'Stanford Encyclopedia of Philosophy', href: `https://plato.stanford.edu/entries/${philosopher.sep}/` })
  if (philosopher.iep) links.push({ label: 'Internet Encyclopedia of Philosophy', href: `https://iep.utm.edu/${philosopher.iep}/` })

  return (
    <article className="thoughts profile" data-define>
      <button className="panel-back" onClick={() => onOpen(null)}>
        ← All thinkers
      </button>

      <header className="profile-head">
        <p className="profile-meta">
          {p.tradition} · {p.dates}
        </p>
        <h2 className="profile-name">{philosopher.name}</h2>
        <p className="profile-place">{p.place}</p>
        <p className="profile-tagline">{p.tagline}</p>
      </header>

      <section>
        <h3 className="profile-h">Who was {philosopher.name}?</h3>
        {p.who.map((para) => (
          <p key={para.slice(0, 24)} className="profile-p">
            {para}
          </p>
        ))}
      </section>

      <section>
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

      <section className="principles">
        <h3 className="profile-h">Principles to live by</h3>
        <ul>
          {p.principles.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="profile-h">Interesting facts</h3>
        <ul className="fact-list">
          {p.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="profile-h">Legacy</h3>
        <p className="profile-p">{p.legacy}</p>
      </section>

      {own.length > 0 && (
        <section>
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
            {names.get(previous.slug)?.name}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button onClick={() => onOpen(next.slug)}>
            <span>Later →</span>
            {names.get(next.slug)?.name}
          </button>
        )}
      </nav>
    </article>
  )
}
