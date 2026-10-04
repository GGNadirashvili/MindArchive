// Parses native-language Wikiquote pages. Quotes are kept in their original language; verse keeps its line breaks.
//   ka, ru: {{Q ...}} templates          fr: {{citation|...}} templates and bullets
//   de, it, es, pl: bullet lists ("* quote", with the source in a footnote, after a dash, or in a sub-bullet)
import { readJson, writeJson } from './lib.mjs'
import { clean } from './parse-wikiquote.mjs'

const SCRIPTS = { ka: /\p{Script=Georgian}/gu, ru: /\p{Script=Cyrillic}/gu }
const TEMPLATE_LANGS = new Set(['ka', 'ru'])
const MAX_PER_PAGE = 150 // keeps the download size bounded for very large pages

// Very common words, to check a Latin-script quote really is in the expected language.
const STOPWORDS = {
  en: 'the of and to a in is that it as be for with by this are was not but or have from at which his her an on you we all they there their will would can has had were been more if one so no what who when than into its our my your he she them these those'.split(' '),
  de: 'der die das und ist nicht ein eine zu den von mit sich auf für es dem im des auch als wie sie ich er wir sind wird nur aber wenn oder zum zur nach bei hat noch dass daß einen einem einer mehr'.split(' '),
  fr: 'le la les de des et est un une que qui pour pas dans ce il elle en du au se sur ne plus par avec son sa ses leur nous vous je tu on mais ou où comme sont être très cette ces tout'.split(' '),
  it: 'il lo la le gli di che e è un una per non con si da in del della dei delle come più ma sono ha era nel nella al alla ai cui se anche ogni suo sua loro essere'.split(' '),
  es: 'el la los las de que y es un una en no por con se su para lo al como más pero sus le ya o fue son del esta este ser muy todo'.split(' '),
  pl: 'i w nie na się z do to że jest jak po co ale czy dla od za przez tylko jego jej ich tak być może przy już o u'.split(' '),
}

const stopRatio = (text, lang) => {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  if (!words.length) return 0
  const set = new Set(STOPWORDS[lang])
  return words.filter((w) => set.has(w)).length / words.length
}

/** Is a Latin-script quote written in `lang` (and not, say, an English translation on the same page)? */
function isLanguage(text, lang) {
  const own = stopRatio(text, lang)
  const words = text.match(/\p{L}+/gu)?.length ?? 0
  if (words < 4 || own < (words < 8 ? 0.1 : 0.15)) return false
  return own >= stopRatio(text, 'en')
}

// Headings for sections about the person, or with disputed authorship.
const ABOUT = {
  de: /über\b|sekundär|zitate (von|über) andere|literatur|weblinks|siehe auch|einzelnachweise/i,
  fr: /\bsur\b|à propos|à son sujet|citations (de|d')? ?(tiers|autres)|bibliographie|voir aussi|liens externes|notes/i,
  it: /\bsu\b|sull|su di|bibliografia|altri progetti|voci correlate|note\b|collegamenti esterni/i,
  es: /sobre\b|acerca de|referencias|enlaces externos|véase también|notas/i,
  pl: /\bo\b|na temat|przypisy|linki zewnętrzne|zobacz też|bibliografia/i,
}
const MISATTRIBUTED = /falsch zugeschrieben|fälschlich|apokryph|erron|fausse|apocryph|apocrif|falsamente|falsa|przypisywane błędnie|błędnie/i
const ATTRIBUTED = /zugeschrieben|unbelegt|attribu|dubbie|atribuid|przypisywane|nieudokumentowane/i
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

const REF = /<ref[^>/]*>([\s\S]*?)<\/ref>/gi
const OPEN_CLOSE = /^\s*(?:«\s*([\s\S]+?)\s*»|„([\s\S]+?)[“”"]|"([\s\S]+?)"|“([\s\S]+?)”|‘([\s\S]+?)’)\s*(?:[–—-]+\s*([\s\S]*))?$/

/** One bullet item -> { text, source } for the western-European editions. */
function bulletToQuote(raw, subs) {
  // {{Versalita|Palomo}} is the author's name in small caps: keep it, drop other templates
  const refs = [...raw.matchAll(REF)].map((m) => clean(m[1].replace(/\{\{(?:Versalita|Small ?caps|Smallcaps)\|([^{}|]*)\}\}/gi, '$1')))
  let body = raw.replace(REF, '').replace(/<ref[^>]*\/>/gi, '')
  let source = refs.find((r) => r && !/^https?:/.test(r)) ?? ''
  // Polish editions list "Opis:" (description) and "Źródło:" (source) as sub-bullets.
  for (const sub of subs) {
    const c = clean(sub)
    if (/^źródło:/i.test(c)) source = c.replace(/^źródło:\s*/i, '')
    else if (!source && !/^(opis|uwagi|komentarz):/i.test(c)) source = c
  }
  body = body.replace(/\s*\/\/\s*/g, '\n') // German verse separator
  let tail = ''
  const m = OPEN_CLOSE.exec(body)
  if (m) {
    body = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5]
    tail = m[6] ?? ''
  }
  const text = body
    .split('\n')
    .map((l) => clean(l))
    .filter(Boolean)
    .join('\n')
    .trim()
  if (!source && tail) source = clean(tail)
  source = source.replace(/^(da|aus|de|from|quelle:?|fuente:?|źródło:?)\s+/i, '').replace(/\.$/, '')
  return { text, source: source.length > 200 || /^https?:/.test(source) ? '' : source }
}

function parseBullets(wikitext, lang) {
  const quotes = []
  let skip = false
  let attributed = false
  let item = null
  const flush = () => {
    if (!item) return
    const { text, source } = bulletToQuote(item.raw, item.subs)
    item = null
    if (skip || text.length < 20 || text.length > 1500 || /\bhttps?:|[{}|]/.test(text) || !isLanguage(text, lang)) return
    quotes.push({ text, source: source || null, attributed })
  }
  for (const line of wikitext.split('\n')) {
    const h = /^(={2,6})\s*(.+?)\s*\1\s*(<!--.*)?$/.exec(line)
    if (h) {
      flush()
      const title = clean(h[2])
      if (h[1].length === 2) attributed = false
      skip = ABOUT[lang].test(title) || MISATTRIBUTED.test(title)
      if (ATTRIBUTED.test(title) && !MISATTRIBUTED.test(title)) attributed = true
      continue
    }
    if (/^\*\*/.test(line)) item?.subs.push(line.replace(/^\*+\s*/, ''))
    else if (/^\*/.test(line)) {
      flush()
      item = { raw: line.replace(/^\*\s*/, ''), subs: [] }
    } else if (item && /^\s*$/.test(line)) flush()
  }
  flush()
  return quotes
}

/** French pages: {{citation|text}} followed by a {{Réf Livre|titre=...|année=...}} source template. */
function parseFrenchCitations(wikitext) {
  const quotes = []
  let skip = false
  const headings = [...wikitext.matchAll(/^={2,6}\s*(.+?)\s*={2,6}\s*$/gm)].map((m) => ({ at: m.index, title: clean(m[1]) }))
  for (let i = wikitext.indexOf('{{citation|'); i !== -1; i = wikitext.indexOf('{{citation|', i + 5)) {
    const end = templateEnd(wikitext, i)
    if (end === -1) continue
    const heading = [...headings].reverse().find((h) => h.at < i)?.title ?? ''
    skip = ABOUT.fr.test(heading) || MISATTRIBUTED.test(heading)
    if (skip) continue
    const params = splitParams(wikitext.slice(i + 2, end - 2)).slice(1)
    // the text is either positional or passed as citation=...
    const raw = params.find((p) => /^\s*(citation|1)\s*=/.test(p))?.replace(/^\s*(citation|1)\s*=/, '') ?? params.find((p) => !/^\s*[\wé]+\s*=/.test(p)) ?? params[0]
    const text = cleanLines(raw ?? '', { unquote: true })
    let source = ''
    const next = /^\s*\{\{\s*(?:Réf|Ref)[^|}]*/i.exec(wikitext.slice(end, end + 40))
    if (next) {
      const refEnd = templateEnd(wikitext, end + next[0].indexOf('{{'))
      const named = new Map()
      for (const p of splitParams(wikitext.slice(end + next[0].indexOf('{{') + 2, refEnd - 2)).slice(1)) {
        const m = /^\s*([^=\s]+)\s*=([\s\S]*)$/.exec(p)
        if (m) named.set(m[1], clean(m[2]))
      }
      source = [named.get('titre') ?? named.get('auteur'), named.get('année')].filter(Boolean).join(', ')
    }
    if (text.length < 20 || text.length > 1500 || /\bhttps?:|[{}|]/.test(text) || !isLanguage(text, 'fr')) continue
    quotes.push({ text, source: source || null, attributed: ATTRIBUTED.test(heading) })
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
    const parsed = (TEMPLATE_LANGS.has(t.lang) ? parseNativePage(wikitext, t.lang) : [...(t.lang === 'fr' ? parseFrenchCitations(wikitext) : []), ...parseBullets(wikitext, t.lang)]).slice(0, MAX_PER_PAGE)
    for (const q of parsed) {
      const norm = q.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      if (seen.get(key).has(norm)) continue
      seen.get(key).add(norm)
      out.push({ pid: t.pid, lang: t.lang, text: q.text, source: q.source, ...(q.attributed ? { attributed: true } : {}) })
    }
  }
  await writeJson('data/raw/quotes-native.json', out)
  const per = {}
  for (const q of out) per[q.lang] = (per[q.lang] ?? 0) + 1
  console.log(`${out.length} native-language quotes`, per)
}
