import { memo, useState } from 'react'
import { lifespan } from '../archive'
import { languageName } from '../languages'
import type { Meta, Quote } from '../types'

interface Props {
  quote: Quote
  meta: Meta
  saved: boolean
  onToggleSave: (id: number) => void
  onPhilosopher: (index: number) => void
  onCategory: (index: number) => void
  onCountry: (country: string) => void
}

export const QuoteCard = memo(function QuoteCard({ quote, meta, saved, onToggleSave, onPhilosopher, onCategory, onCountry }: Props) {
  const [copied, setCopied] = useState(false)
  const ph = meta.philosophers[quote.p]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`“${quote.text}” — ${ph.name}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable (insecure context); ignore */
    }
  }

  // translate="no" on original-language quotes: Chrome would otherwise machine-translate them to English
  return (
    <article className="card" data-lang={quote.lang} translate={quote.lang !== 'en' ? 'no' : undefined}>
      <blockquote className={`card-text ${quote.lang !== 'en' ? 'card-native' : ''}`} lang={quote.lang} data-define={quote.lang === 'en' ? '' : undefined}>
        {quote.text}
      </blockquote>
      {quote.orig && (
        <p className="card-orig">
          {quote.orig}
        </p>
      )}
      <footer className="card-foot">
        <div className="card-author">
          <button className="author-name" onClick={() => onPhilosopher(quote.p)}>
            {ph.name}
          </button>
          <span className="author-meta">
            {meta.roles[ph.roles[0]].name} · <button className="link-btn" onClick={() => onCountry(ph.country)}>
              {ph.country}
            </button>
            {lifespan(ph.born, ph.died) && <> · {lifespan(ph.born, ph.died)}</>}
          </span>
          {quote.source && <span className="card-source" title={quote.source}>{quote.source}</span>}
        </div>
        <div className="card-actions">
          <button className={`icon-btn ${saved ? 'on' : ''}`} onClick={() => onToggleSave(quote.id)} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save quote'} title={saved ? 'Saved' : 'Save'}>
            {saved ? '★' : '☆'}
          </button>
          <button className="icon-btn" onClick={copy} aria-label="Copy quote" title="Copy">
            {copied ? '✓' : '⧉'}
          </button>
        </div>
      </footer>
      <div className="card-tags">
        {quote.cats.map((c) => (
          <button key={c} className="tag" onClick={() => onCategory(c)}>
            {meta.categories[c].name}
          </button>
        ))}
        {quote.featured && <span className="tag tag-pd" title="One of this thinker's best-known lines">Famous</span>}
        {quote.attributed && <span className="tag" title="Wikiquote lists this as attributed or disputed: the source is unconfirmed">Attributed</span>}
        {quote.lang !== 'en' && <span className="tag tag-pd" title="Shown in the original language">{languageName(quote.lang)}</span>}
        {quote.translated && <span className="tag" title="English translation by MindArchive, not the original wording">Translated</span>}
        {quote.publicDomain && <span className="tag tag-pd" title="Passage from a public-domain text on Project Gutenberg">Public domain</span>}
      </div>
    </article>
  )
})
