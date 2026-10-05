import { useEffect, useRef, useState, type ReactNode } from 'react'
import { lookup, wiktionaryUrl, wordAtPoint, type DefPart, type Definition } from '../define'

interface Target {
  word: string
  rect: DOMRect
}

type State = { status: 'loading' } | { status: 'done'; definition: Definition } | { status: 'none' } | { status: 'error'; message: string }

const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 30

/**
 * Double-click (or double-tap) any English quote text to see what a word means.
 * Elements opt in with `data-define`; the popup is a small card next to the word, or a bottom sheet on phones.
 */
export function WordPopup() {
  const [target, setTarget] = useState<Target | null>(null)
  const [trail, setTrail] = useState<string[]>([]) // words looked up from inside the popup, for "back"
  // The result is tagged with its word, so a stale result is never shown for a newer word.
  const [result, setResult] = useState<{ word: string; state: State } | null>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  const word = trail.length ? trail[trail.length - 1] : target?.word
  const state: State = result && result.word === word ? result.state : { status: 'loading' }

  // Open on double-click / double-tap over opted-in text.
  useEffect(() => {
    let lastTap = { t: 0, x: 0, y: 0 }
    let lastOpen = 0

    const open = (x: number, y: number, el: EventTarget | null) => {
      if (!(el instanceof Element) || !el.closest('[data-define]')) return
      const hit = wordAtPoint(x, y)
      if (!hit) return
      lastOpen = Date.now()
      setTrail([])
      setTarget(hit)
    }

    const onDblClick = (e: MouseEvent) => {
      if (Date.now() - lastOpen < 500) return // already handled as a double-tap
      open(e.clientX, e.clientY, e.target)
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (!t) return
      const now = Date.now()
      const isSecondTap = now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < DOUBLE_TAP_PX
      lastTap = { t: now, x: t.clientX, y: t.clientY }
      if (isSecondTap) {
        lastTap.t = 0
        open(t.clientX, t.clientY, e.target)
      }
    }
    document.addEventListener('dblclick', onDblClick)
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('dblclick', onDblClick)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Fetch the definition whenever the word changes.
  useEffect(() => {
    if (!word) return
    let cancelled = false
    lookup(word)
      .then((definition) => !cancelled && setResult({ word, state: definition ? { status: 'done', definition } : { status: 'none' } }))
      .catch((e: unknown) => !cancelled && setResult({ word, state: { status: 'error', message: e instanceof Error ? e.message : 'Lookup failed' } }))
    return () => {
      cancelled = true
    }
  }, [word])

  // Close on Escape, outside click, or scroll (the card is anchored to the word).
  useEffect(() => {
    if (!target) return
    const close = () => {
      setTarget(null)
      setTrail([])
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => {
      if (popup.current && !popup.current.contains(e.target as Node)) close()
    }
    const onScroll = () => window.innerWidth > 700 && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [target])

  // Place the card below the word (above if there is no room), kept inside the viewport.
  useEffect(() => {
    if (!target || !popup.current) return
    const card = popup.current.getBoundingClientRect()
    const margin = 12
    const left = Math.min(Math.max(margin, target.rect.left + target.rect.width / 2 - card.width / 2), window.innerWidth - card.width - margin)
    const below = target.rect.bottom + 10
    const top = below + card.height + margin > window.innerHeight && target.rect.top - card.height - 10 > margin ? target.rect.top - card.height - 10 : below
    setPosition({ left, top })
  }, [target, state.status, word])

  if (!target || !word) return null

  const renderPart = (part: DefPart, i: number): ReactNode => {
    if (typeof part === 'string') return part
    if ('lookup' in part) {
      return (
        <button key={i} className="wp-link" onClick={() => setTrail((t) => [...t, part.lookup])}>
          {part.text}
        </button>
      )
    }
    return part.style === 'em' ? <em key={i}>{part.text}</em> : <strong key={i}>{part.text}</strong>
  }

  return (
    <div ref={popup} className="word-popup" role="dialog" aria-label={`Meaning of ${word}`} style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}>
      <div className="wp-head">
        {trail.length > 0 && (
          <button className="wp-back" onClick={() => setTrail((t) => t.slice(0, -1))} aria-label="Back">
            ←
          </button>
        )}
        <span className="wp-word">{state.status === 'done' ? state.definition.word : word}</span>
        <button
          className="wp-close"
          onClick={() => {
            setTarget(null)
            setTrail([])
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {state.status === 'loading' && <p className="wp-note">Looking it up…</p>}
      {state.status === 'none' && (
        <p className="wp-note">
          No definition found for “{word}”. <a href={wiktionaryUrl(word)} target="_blank" rel="noreferrer noopener">Search Wiktionary ↗</a>
        </p>
      )}
      {state.status === 'error' && <p className="wp-note">Could not reach the dictionary ({state.message}). Check your connection and try again.</p>}
      {state.status === 'done' && (
        <>
          <div className="wp-body">
            {state.definition.meanings.map((m) => (
              <section key={m.pos}>
                <h3 className="wp-pos">{m.pos}</h3>
                <ol>
                  {m.definitions.map((parts, i) => (
                    <li key={i}>{parts.map(renderPart)}</li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <a className="wp-more" href={state.definition.url} target="_blank" rel="noreferrer noopener">
            Wiktionary ↗
          </a>
        </>
      )}
    </div>
  )
}
