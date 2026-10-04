// Turns raw Wikiquote wikitext into clean { text, source } quotes.
import { readJson, writeJson } from './lib.mjs'

const SKIP_SECTIONS = /^(quotes? about|about|misattributed|see also|external links|further reading|notes|references|sources?|bibliography|works|quotes? by)\b/i

const ENTITIES = { '&mdash;': '—', '&ndash;': '–', '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&hellip;': '…', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&apos;': "'" }

export function clean(s) {
  let t = s
  t = t.replace(/<!--[\s\S]*?-->/g, '')
  t = t.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  for (let i = 0; i < 3; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '')
  t = t.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
  t = t.replace(/\[\[:?(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  t = t.replace(/\[(?:https?:)?\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[(?:https?:)?\/\/\S+\]/g, '')
  t = t.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, '')
  t = t.replace(/'{2,5}/g, '')
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  t = t.replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
  return t.replace(/\s+/g, ' ').trim()
}

const wholeItalic = (raw) => /^'{2}[^']/.test(raw.trim()) && /[^']'{2}[.!?;,\s]*$/.test(raw.trim()) && !/'''/.test(raw)

const EN_STOP = new Set('the of and to a in is that it as be for with by this are was not but or have from at which his her an on you we all they there their will would can has had were been more if one so no what who when than into its our my your he she them these those'.split(' '))

// Cheap English detector: share of very common English words.
const looksEnglish = (text) => {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? []
  if (words.length < 5) return false
  return words.filter((w) => EN_STOP.has(w)).length / words.length >= 0.12
}

// Heuristic: a source line looks like a citation (work title, year, page number).
const looksLikeCitation = (t) => t.length < 160 && (/\d{3,4}/.test(t) || /\b(p|pp|ch|chap|book|bk|section|sec|letter|vol|part|act|scene|aphorism|§)\b/i.test(t) || t.length < 60)

const tidy = (text) => text.replace(/^:+\s*/, '').replace(/\s+pp?\.\s*\d+[\d\-–]*\.?$/i, '').replace(/^["“”]+|["“”]+$/g, '').trim()

/** Is this string a clean English quotation (not a note, citation, or untranslated text)? */
function isQuotable(text) {
  if (text.length < 25 || text.length > 700) return false
  if (text.split(' ').length < 5) return false
  if (/[{}|]|\bhttps?:/.test(text)) return false
  if (/^(see|cf\.)\b/i.test(text)) return false
  // Editorial notes and bibliography lines that are not quotations.
  if (/quote investigator|\bwikiquote\b|\bsee:|\(with variants\)|,\s*(?:ed|eds|trans)\.|University Press|\(\d{4}\)\s*$/i.test(text) || /\bUP\b/.test(text)) return false
  // Mostly non-latin text (untranslated) is not useful for an English archive.
  const letters = text.match(/\p{L}/gu) ?? []
  const latin = text.match(/\p{Script=Latin}/gu) ?? []
  if (!letters.length || latin.length / letters.length < 0.9) return false
  return looksEnglish(text)
}

const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * @param {string} wikitext
 * @param {{ startInQuotes?: boolean, defaultSource?: string | null }} [options]
 *   Work pages have no "Quotes" heading, so they start inside the quote list.
 */
function parsePage(wikitext, { startInQuotes = false, defaultSource = null } = {}) {
  const lines = wikitext.split('\n')
  const quotes = []
  let skipping = false
  let inQuotes = startInQuotes
  // Quotes under Wikiquote's "Attributed"/"Disputed" headings have no solid source; we keep them, flagged.
  let attributed = false
  let work = null
  let current = null

  const flush = () => {
    if (!current) return
    const q = current
    current = null
    let text = clean(q.text)
    const children = q.children.map(clean).filter(Boolean)
    let source = null

    // Foreign-language original followed by an English translation.
    if (wholeItalic(q.text) && children.length) {
      const idx = children.findIndex((c) => c.length > 40 && !looksLikeCitation(c))
      if (idx === -1) return
      text = children[idx]
      children.splice(idx, 1)
    }
    if (children.length) source = children[children.length - 1]
    if (source && /^(quoted|as quoted|cited|see|\(?translat)/i.test(source)) source = source.replace(/^(as )?(quoted|cited) (in|by|from)\s*/i, '')
    if (!source && work) source = work
    if (!source) source = defaultSource

    text = tidy(text)
    if (!isQuotable(text)) return

    quotes.push({ text, source: source && source.length <= 220 ? source : work, attributed, featured: false })
  }

  for (const line of lines) {
    const h = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line)
    if (h) {
      flush()
      const level = h[1].length
      const title = clean(h[2])
      if (level === 2) {
        skipping = SKIP_SECTIONS.test(title)
        inQuotes = !skipping
        attributed = /^(attributed|disputed)/i.test(title)
        work = null
      } else if (!skipping) {
        work = SKIP_SECTIONS.test(title) ? null : title
        if (/^(quotes? about|misattributed)/i.test(title)) skipping = true
        else if (/^(attributed|disputed)/i.test(title)) attributed = true
      }
      continue
    }
    if (skipping || !inQuotes) continue
    if (/^\* /.test(line) || /^\*[^*:]/.test(line)) {
      flush()
      current = { text: line.replace(/^\*\s*/, ''), children: [] }
    } else if (/^\*\* /.test(line) || /^\*\*[^*]/.test(line)) {
      if (current) current.children.push(line.replace(/^\*+\s*/, ''))
    } else if (/^\*\*\*/.test(line)) {
      continue
    } else if (line.trim() === '') {
      continue
    } else if (/^[^*:]/.test(line) || /^:/.test(line)) {
      flush()
    }
  }
  flush()

  // Image captions on Wikiquote are the page's featured quotes: usually the best-known lines,
  // often a shorter form of a longer quote below ("The unexamined life is not worth living.").
  const byKey = new Map(quotes.map((q) => [normalize(q.text), q]))
  for (const m of wikitext.matchAll(/\[\[(?:File|Image):((?:[^\[\]]|\[\[[^\]]*\]\])*)\]\]/g)) {
    const caption = tidy(clean(m[1].replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').split('|').pop()))
    if (!isQuotable(caption)) continue
    const key = normalize(caption)
    const exact = byKey.get(key)
    if (exact) {
      exact.featured = true
      continue
    }
    const container = quotes.find((q) => normalize(q.text).includes(key))
    const quote = { text: caption, source: container?.source ?? defaultSource, attributed: container?.attributed ?? false, featured: true }
    quotes.push(quote)
    byKey.set(key, quote)
  }
  return quotes
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { existsSync } = await import('node:fs')
  const philosophers = await readJson('data/raw/philosophers.json')
  const pages = await readJson('data/raw/wikiquote.json')
  const works = existsSync('data/raw/works.json') ? await readJson('data/raw/works.json') : []
  const idByName = new Map(philosophers.map((p) => [p.name, p.id]))

  // Socratic dialogues: Socrates is the speaker, so the lines are credited to him as well as Plato.
  const alsoCreditedTo = { 'Apology (Plato)': 'Socrates', Crito: 'Socrates', Phaedo: 'Socrates' }

  const out = []
  const seen = new Map() // pid -> set of normalized texts
  const add = (pid, q, source) => {
    if (!seen.has(pid)) seen.set(pid, new Set())
    const key = q.text.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.get(pid).has(key)) return
    seen.get(pid).add(key)
    out.push({ pid, text: q.text, source: source ?? null, attributed: q.attributed, featured: q.featured })
  }

  for (const p of philosophers) {
    const wt = pages[p.wikiquote]
    if (wt) for (const q of parsePage(wt)) add(p.id, q, q.source)
  }

  for (const w of works) {
    const wt = pages[w.title]
    if (!wt) continue
    const label = w.title.replace(/\s*\(.*?\)$/, '')
    for (const q of parsePage(wt, { startInQuotes: true, defaultSource: label })) {
      // Keep the work's name in the citation ("Apology, 38a") unless the source already names it.
      const source = q.source && q.source !== label && !q.source.includes(label) && q.source.length < 70 ? `${label}, ${q.source}` : q.source
      add(w.pid, q, source)
      const also = idByName.get(alsoCreditedTo[w.title])
      if (also && also !== w.pid) add(also, q, `${philosophers.find((p) => p.id === w.pid).name}, ${source}`)
    }
  }

  await writeJson('data/raw/quotes-wikiquote.json', out)
  const per = new Map()
  for (const q of out) per.set(q.pid, (per.get(q.pid) ?? 0) + 1)
  console.log(`${out.length} quotes from ${per.size} thinkers (${out.filter((q) => q.attributed).length} attributed, ${out.filter((q) => q.featured).length} featured)`)
}
