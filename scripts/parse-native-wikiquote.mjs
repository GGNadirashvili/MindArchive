// Parses native-language Wikiquote pages (Georgian, Russian) that store quotes in a {{Q ...}} template:
//   ka: {{Q | ციტატა = ... | დამოწმება = source }}      ru: {{Q|text|Автор=source}}
// Quotes are kept in their original language; verse keeps its line breaks.
import { readJson, writeJson } from './lib.mjs'
import { clean } from './parse-wikiquote.mjs'

const SCRIPTS = { ka: /\p{Script=Georgian}/gu, ru: /\p{Script=Cyrillic}/gu }
const QUOTE_PARAMS = new Set(['ციტატა', 'цитата', 'text', 'quote'])
const SOURCE_PARAMS = ['დამოწმება', 'Источник', 'источник', 'Автор', 'автор']
const ABOUT_HEADING = /შესახებ|მასზე|about|^о\s|цитаты о|об\s/i

/** Position of the matching "}}" for the "{{" at `start`, or -1. */
function templateEnd(text, start) {
  let depth = 0
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++
      i++
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/** Splits template parameters on top-level "|" (ignoring pipes inside [[links]] and {{templates}}). */
function splitParams(body) {
  const parts = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '[[' || two === '{{') {
      depth++
      cur += two
      i++
    } else if (two === ']]' || two === '}}') {
      depth--
      cur += two
      i++
    } else if (body[i] === '|' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += body[i]
  }
  parts.push(cur)
  return parts
}

/** Cleans wikitext but keeps the line structure (poetry is stored one ":line" per row). */
function cleanLines(value, { unquote = false } = {}) {
  const unwrapped = value.replace(/\{\{მთავრული\|([^{}|]*)\}\}/g, '$1')
  const text = unwrapped
    .split('\n')
    .map((l) => clean(l.replace(/^[:*#\s]+/, '').replace(/^[-–]\s+(?=\S)/, '')))
    .filter(Boolean)
    .join('\n')
    .trim()
  // Drop a surrounding pair of quotation marks („…“, «…», "…"), but never half of a pair.
  return unquote ? text.replace(/^(?:„([\s\S]*)[“”]|«([\s\S]*)»|"([\s\S]*)"|“([\s\S]*)”)$/, (_, a, b, c, d) => a ?? b ?? c ?? d) : text
}

export function parseNativePage(wikitext, lang) {
  const script = SCRIPTS[lang]
  const quotes = []
  const headings = [...wikitext.matchAll(/^={2,6}\s*(.+?)\s*={2,6}\s*$/gm)].map((m) => ({ at: m.index, title: clean(m[1]) }))

  for (let i = wikitext.indexOf('{{Q'); i !== -1; i = wikitext.indexOf('{{Q', i + 3)) {
    if (!/^\{\{Q[\s|]/.test(wikitext.slice(i, i + 4))) continue
    const end = templateEnd(wikitext, i)
    if (end === -1) continue
    const heading = [...headings].reverse().find((h) => h.at < i)?.title ?? ''
    if (ABOUT_HEADING.test(heading)) continue

    const params = splitParams(wikitext.slice(i + 2, end - 2)).slice(1)
    const named = new Map()
    const positional = []
    for (const p of params) {
      const m = /^\s*([^\s=[\]{}|]+)\s*=([\s\S]*)$/.exec(p)
      if (m) named.set(m[1], m[2])
      else positional.push(p)
    }
    const raw = [...named].find(([k]) => QUOTE_PARAMS.has(k))?.[1] ?? positional[0]
    if (!raw) continue
    const text = cleanLines(raw, { unquote: true })

    const letters = text.match(/\p{L}/gu) ?? []
    const inScript = text.match(script) ?? []
    if (text.length < 12 || text.length > 1500 || text.split(/\s+/).length < 3) continue
    if (/\bhttps?:|[{}|]/.test(text) || !letters.length || inScript.length / letters.length < 0.6) continue

    const sourceRaw = SOURCE_PARAMS.map((k) => named.get(k)).find((v) => v && clean(v))
    let source = sourceRaw ? cleanLines(sourceRaw).replace(/\s*\n\s*/g, ' ') : ''
    if (/^https?:|^\[?https?:/.test(source) || source.length > 200) source = ''
    quotes.push({ text, source: source || null })
  }
  return quotes
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = await readJson('data/raw/native-targets.json')
  const pages = await readJson('data/raw/native-pages.json')
  const out = []
  const seen = new Map()
  for (const t of targets) {
    const wikitext = pages[`${t.lang}|${t.title}`]
    if (!wikitext) continue
    const key = `${t.pid}|${t.lang}`
    if (!seen.has(key)) seen.set(key, new Set())
    for (const q of parseNativePage(wikitext, t.lang)) {
      const norm = q.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      if (seen.get(key).has(norm)) continue
      seen.get(key).add(norm)
      out.push({ pid: t.pid, lang: t.lang, text: q.text, source: q.source })
    }
  }
  await writeJson('data/raw/quotes-native.json', out)
  const per = {}
  for (const q of out) per[q.lang] = (per[q.lang] ?? 0) + 1
  console.log(`${out.length} native-language quotes`, per)
}
