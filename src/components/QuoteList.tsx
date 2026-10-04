import { useEffect, useMemo, useRef, useState } from 'react'
import type { Row } from '../archive'
import type { Meta } from '../types'
import { QuoteCard } from './QuoteCard'

const PAGE = 30

interface Props {
  rows: Row[]
  meta: Meta
  saved: Set<number>
  onToggleSave: (id: number) => void
  onPhilosopher: (index: number) => void
  onCategory: (index: number) => void
  onCountry: (country: string) => void
}

export function QuoteList({ rows, meta, saved, ...handlers }: Props) {
  // Reset the page size whenever the result set changes (derived during render, no effect needed).
  const [paging, setPaging] = useState({ rows, limit: PAGE })
  if (paging.rows !== rows) setPaging({ rows, limit: PAGE })
  const limit = paging.limit
  const setLimit = (update: (n: number) => number) => setPaging((p) => ({ ...p, limit: update(p.limit) }))
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((n) => n + PAGE), { rootMargin: '900px' })
    io.observe(el)
    return () => io.disconnect()
  }, [rows, limit])

  // Number of quotes per heading, so headings can show a count.
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    let current = ''
    for (const r of rows) {
      if (r.group) current = r.group
      if (current) counts.set(current, (counts.get(current) ?? 0) + 1)
    }
    return counts
  }, [rows])

  if (!rows.length) {
    return (
      <div className="empty">
        <p className="empty-title">Nothing here yet.</p>
        <p>No quotes match these filters. Try removing a filter or searching for a different word.</p>
      </div>
    )
  }

  return (
    <div className="list">
      {rows.slice(0, limit).map(({ quote, group }) => (
        <div key={quote.id}>
          {group && (
            <h2 className="group-head">
              <span>{group}</span>
              <span className="group-count">{groupCounts.get(group)?.toLocaleString()}</span>
            </h2>
          )}
          <QuoteCard quote={quote} meta={meta} saved={saved.has(quote.id)} {...handlers} />
        </div>
      ))}
      {limit < rows.length && <div ref={sentinel} className="sentinel">Loading more…</div>}
      {limit >= rows.length && <div className="end">· end of results ·</div>}
    </div>
  )
}
