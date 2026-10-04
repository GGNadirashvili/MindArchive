import { useEffect } from 'react'
import { lifespan } from '../archive'
import type { Philosopher } from '../types'

interface Props {
  roles: string[]
  schools: string[]
  philosopher: Philosopher
  onClose: () => void
  onShowQuotes: (index: number) => void
  onCountry: (country: string) => void
}

export function PhilosopherModal({ roles: roleNames, schools: schoolNames, philosopher: p, onClose, onShowQuotes, onCountry }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const links: { label: string; href: string }[] = []
  if (p.wiki) links.push({ label: 'Wikipedia', href: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, '_'))}` })
  if (p.sep) links.push({ label: 'Stanford Encyclopedia', href: `https://plato.stanford.edu/entries/${p.sep}/` })
  if (p.iep) links.push({ label: 'Internet Encyclopedia', href: `https://iep.utm.edu/${p.iep}/` })
  links.push({ label: 'Wikiquote', href: `https://${p.wql ?? 'en'}.wikiquote.org/wiki/${encodeURIComponent(p.wq.replace(/ /g, '_'))}` })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-head">
          {p.img ? <img className="portrait" src={p.img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="portrait portrait-empty">{p.name[0]}</div>}
          <div>
            <h2 className="modal-name">{p.name}</h2>
            <p className="modal-life">{lifespan(p.born, p.died)}</p>
            <p className="modal-where">
              <button className="link-btn" onClick={() => onCountry(p.country)}>
                {p.country}
              </button>
              {p.continent !== 'Unknown' && <> · {p.continent}</>} · {p.era}
            </p>
          </div>
        </div>
        {p.desc && <p className="modal-desc">{p.desc}</p>}
        {(roleNames.length > 0 || schoolNames.length > 0) && (
          <p className="modal-schools">
            {roleNames.map((r) => (
              <span key={r} className="tag tag-pd">
                {r}
              </span>
            ))}
            {schoolNames.slice(0, 5).map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </p>
        )}
        <button className="btn-primary" onClick={() => onShowQuotes(p.i)}>
          Show all {p.n.toLocaleString()} quotes
        </button>
        <div className="modal-links">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer noopener">
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
