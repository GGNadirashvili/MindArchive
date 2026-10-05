// Word definitions from the Wiktionary REST API (CORS-enabled, no key, CC BY-SA).

/** A piece of a definition: plain text, an emphasised span, or a linked word that can be looked up. */
export type DefPart = string | { text: string; lookup: string } | { text: string; style: 'em' | 'strong' }

export interface Meaning {
  pos: string
  definitions: DefPart[][]
}

export interface Definition {
  word: string
  meanings: Meaning[]
  /** Link to the full Wiktionary entry */
  url: string
}

const MAX_MEANINGS = 4 // parts of speech shown
const MAX_DEFINITIONS = 3 // definitions per part of speech

const cache = new Map<string, Promise<Definition | null>>()

export const wiktionaryUrl = (word: string) => `https://en.wiktionary.org/wiki/${encodeURIComponent(word.replace(/ /g, '_'))}`

/** Turns the HTML of one definition into safe parts (no raw HTML is ever injected). */
function toParts(html: string): DefPart[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const parts: DefPart[] = []
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) parts.push(child.textContent)
      } else if (child instanceof HTMLElement) {
        const tag = child.tagName.toLowerCase()
        const text = child.textContent ?? ''
        if (tag === 'a' && child.getAttribute('rel') === 'mw:WikiLink' && !child.getAttribute('href')?.includes(':')) {
          parts.push({ text, lookup: child.getAttribute('title') ?? text })
        } else if (tag === 'i' || tag === 'em') parts.push({ text, style: 'em' })
        else if (tag === 'b' || tag === 'strong') parts.push({ text, style: 'strong' })
        else if (tag === 'style' || tag === 'script' || tag === 'sup') return
        else walk(child)
      }
    })
  }
  walk(doc.body.firstElementChild!)
  return parts
}

async function fetchEntry(term: string): Promise<Definition | null> {
  const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Dictionary unavailable (${res.status})`)
  const json = (await res.json()) as { en?: { partOfSpeech: string; definitions: { definition: string }[] }[] }
  const meanings = (json.en ?? [])
    .map((entry) => ({
      pos: entry.partOfSpeech,
      definitions: entry.definitions
        .map((d) => toParts(d.definition))
        .filter((parts) => parts.some((p) => (typeof p === 'string' ? p.trim() : p.text.trim())))
        .slice(0, MAX_DEFINITIONS),
    }))
    .filter((m) => m.definitions.length)
    .slice(0, MAX_MEANINGS)
  return meanings.length ? { word: term, meanings, url: wiktionaryUrl(term) } : null
}

/** Looks a word up, trying lower case first, then the capitalised form (proper nouns such as "Socrates"). */
export function lookup(word: string): Promise<Definition | null> {
  const key = word.toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached
  const request = (async () => {
    const candidates = [...new Set([word.toLowerCase(), word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()])]
    for (const term of candidates) {
      const found = await fetchEntry(term)
      if (found) return found
    }
    return null
  })()
  // don't keep failures (e.g. offline) in the cache
  request.catch(() => cache.delete(key))
  cache.set(key, request)
  return request
}

/** The word under a screen point, with its bounding box. Works for text nodes only. */
export function wordAtPoint(x: number, y: number): { word: string; rect: DOMRect } | null {
  let node: Node | null = null
  let offset = 0
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y)
    node = pos?.offsetNode ?? null
    offset = pos?.offset ?? 0
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y)
    node = range?.startContainer ?? null
    offset = range?.startOffset ?? 0
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  const text = node.textContent ?? ''
  const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{M}'’-]/u.test(c)
  let start = Math.min(offset, text.length)
  let end = start
  while (start > 0 && isWordChar(text[start - 1])) start--
  while (end < text.length && isWordChar(text[end])) end++
  const raw = text.slice(start, end)
  // strip quote marks, hyphens and possessive 's
  const word = raw.replace(/^['’-]+|['’-]+$/g, '').replace(/['’]s$/i, '')
  if (!word || word.length > 40) return null
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  return { word, rect: range.getBoundingClientRect() }
}
