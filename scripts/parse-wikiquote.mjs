// Turns raw Wikiquote wikitext into clean { text, source } quotes.
import { readJson, writeJson } from './lib.mjs'

const SKIP_SECTIONS = /^(quotes? about|about|disputed|misattributed|attributed|see also|external links|further reading|notes|references|sources?|bibliography|works|quotes? by)\b/i

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

function parsePage(wikitext) {
  const lines = wikitext.split('\n')
  const quotes = []
  let skipping = false
  let inQuotes = false
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

    text = text.replace(/^:+\s*/, '').replace(/\s+pp?\.\s*\d+[\d\-–]*\.?$/i, '').replace(/^["“”]+|["“”]+$/g, '').trim()
    if (text.length < 25 || text.length > 700) return
    if (text.split(' ').length < 5) return
    if (/[{}|]|\bhttps?:/.test(text)) return
    if (/^(see|cf\.)\b/i.test(text)) return
    // Editorial notes and bibliography lines that are not quotations.
    if (/quote investigator|\bwikiquote\b|\bsee:|\(with variants\)|,\s*(?:ed|eds|trans)\.|University Press|\(\d{4}\)\s*$/i.test(text) || /\bUP\b/.test(text)) return
    // Mostly non-latin text (untranslated) is not useful for an English archive.
    const letters = text.match(/\p{L}/gu) ?? []
    const latin = text.match(/\p{Script=Latin}/gu) ?? []
    if (!letters.length || latin.length / letters.length < 0.9) return
    if (!looksEnglish(text)) return

    quotes.push({ text, source: source && source.length <= 220 ? source : work })
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
        work = null
      } else if (!skipping) {
        work = SKIP_SECTIONS.test(title) ? null : title
        if (/^(quotes? about|disputed|misattributed|attributed)/i.test(title)) skipping = true
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
  return quotes
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const philosophers = await readJson('data/raw/philosophers.json')
  const pages = await readJson('data/raw/wikiquote.json')
  const out = []
  for (const p of philosophers) {
    const wt = pages[p.wikiquote]
    if (!wt) continue
    const seen = new Set()
    for (const q of parsePage(wt)) {
      const key = q.text.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ pid: p.id, text: q.text, source: q.source ?? null })
    }
  }
  await writeJson('data/raw/quotes-wikiquote.json', out)
  const per = new Map()
  for (const q of out) per.set(q.pid, (per.get(q.pid) ?? 0) + 1)
  console.log(`${out.length} quotes from ${per.size} philosophers`)
}
