// Native-language quotes: for each thinker, look for a Wikiquote edition in the language they
// wrote in (Wikidata "native language" / "languages spoken or written"), e.g. Georgian for Rustaveli.
// Also adds Georgian thinkers that have a Georgian Wikiquote page but no English one.
//
//   node scripts/fetch-native.mjs [ka ru ...]      (default: ka ru)
import { existsSync } from 'node:fs'
import { loadCurated } from './curated.mjs'
import { chunk, fetchJson, fetchWikitext, readJson, sleep, sparql, val, writeJson } from './lib.mjs'
import { ROLES, classifyRoles } from './roles.mjs'
import { fetchThinkers } from './thinker-query.mjs'

const LANGS = process.argv.length > 2 ? process.argv.slice(2) : ['ka', 'ru']
// Languages whose Wikiquote edition lists *every* person we are willing to add as a new thinker.
const ADD_NEW_THINKERS = new Set(['ka'])

const philosophers = await readJson('data/raw/philosophers.json')
const curated = await loadCurated()
const known = [...philosophers, ...curated.map((c) => c.thinker)]
// A curated record can pin the languages to use (e.g. Mamardashvili: Georgian only).
const pinned = new Map(curated.filter((c) => c.thinker.languages).map((c) => [c.thinker.id, c.thinker.languages]))
const byId = new Map(known.map((t) => [t.id, t]))

const sites = LANGS.map((l) => `<https://${l}.wikiquote.org/>`).join(', ')
const targets = new Map() // `${id}|${lang}` -> { pid, lang, title }

// 1. Existing thinkers: native-language edition = a language the thinker wrote in, with a page.
for (const group of chunk([...byId.keys()], 150)) {
  const rows = await sparql(`
    SELECT ?p ?site ?title ?code WHERE {
      VALUES ?p { ${group.map((i) => 'wd:' + i).join(' ')} }
      ?s schema:about ?p ; schema:isPartOf ?site ; schema:name ?title .
      FILTER(?site IN (${sites}))
      OPTIONAL { ?p (wdt:P103|wdt:P1412) ?l . ?l wdt:P218 ?code . }
    }`)
  const perThinker = new Map()
  for (const r of rows) {
    const pid = val(r, 'p').split('/').pop()
    const lang = /https:\/\/([a-z-]+)\.wikiquote/.exec(val(r, 'site'))[1]
    const entry = perThinker.get(`${pid}|${lang}`) ?? { pid, lang, title: val(r, 'title'), codes: new Set() }
    if (val(r, 'code')) entry.codes.add(val(r, 'code'))
    perThinker.set(`${pid}|${lang}`, entry)
  }
  for (const e of perThinker.values()) {
    const t = byId.get(e.pid)
    const allowed = pinned.get(e.pid)
    const isNative = allowed ? allowed.includes(e.lang) : e.codes.has(e.lang) || (e.lang === 'ka' && (t.country === 'Georgia' || t.citizenship === 'Georgia'))
    if (isNative) targets.set(`${e.pid}|${e.lang}`, { pid: e.pid, lang: e.lang, title: e.title })
  }
  await sleep(600)
}
console.log(`${targets.size} native-language pages for thinkers already in the archive`)

// 2. New thinkers: people on a Georgian Wikiquote who are not in the archive yet. That edition also
// quotes many foreign celebrities in translation, so keep only people who are Georgian themselves
// (country or native language), have died, and are not primarily politicians or athletes.
const NOT_THINKER_ROLES = new Set([ROLES.findIndex((r) => r.id === 'politics'), ROLES.length])
const nativeLanguages = async (ids) => {
  const rows = await sparql(`SELECT ?p ?code WHERE { VALUES ?p { ${ids.map((i) => 'wd:' + i).join(' ')} } ?p (wdt:P103|wdt:P1412) ?l . ?l wdt:P218 ?code . }`)
  const out = new Map()
  for (const r of rows) out.set(val(r, 'p').split('/').pop(), [...(out.get(val(r, 'p').split('/').pop()) ?? []), val(r, 'code')])
  return out
}
const newThinkers = []
const api = (host, params) => `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`

/** Every page title on a Wikiquote edition with its Wikidata id when the page is linked to one. */
async function listPages(host) {
  const pages = []
  for (let cont = {}; cont; ) {
    const json = await fetchJson(api(host, { action: 'query', generator: 'allpages', gapnamespace: '0', gapfilterredir: 'nonredirects', gaplimit: '500', prop: 'pageprops', ppprop: 'wikibase_item', ...cont }))
    for (const p of json.query?.pages ?? []) pages.push({ title: p.title, id: p.pageprops?.wikibase_item ?? null })
    cont = json.continue ?? null
  }
  return pages
}

/** Some pages are not linked from Wikidata; find the item by searching the page title in that language. */
async function findItem(lang, title) {
  const json = await fetchJson(api('www.wikidata.org', { action: 'wbsearchentities', search: title, language: lang, uselang: 'en', type: 'item', limit: '3' }))
  return json.search?.find((x) => /georgia/i.test(x.description ?? ''))?.id ?? null
}

for (const lang of LANGS.filter((l) => ADD_NEW_THINKERS.has(l))) {
  const host = `${lang}.wikiquote.org`
  const titleById = new Map()
  for (const page of await listPages(host)) {
    const id = page.id ?? (await findItem(lang, page.title))
    if (id && !byId.has(id)) titleById.set(id, page.title)
    await sleep(page.id ? 0 : 150)
  }
  const ids = [...titleById.keys()]
  for (const group of chunk(ids, 80)) {
    const found = await fetchThinkers(group, null, lang, titleById)
    const languages = await nativeLanguages(found.map((t) => t.id))
    for (const t of found) {
      const ours = t.country === 'Georgia' || t.citizenship === 'Georgia' || (languages.get(t.id) ?? []).includes(lang)
      if (!ours || t.died === null || NOT_THINKER_ROLES.has(classifyRoles(t.description)[0])) continue
      newThinkers.push(t)
      targets.set(`${t.id}|${lang}`, { pid: t.id, lang, title: t.wikiquote })
    }
    await sleep(800)
  }
}
console.log(`${newThinkers.length} new thinkers from native Wikiquote editions`)

// 3. Download the pages.
const pages = {}
for (const lang of LANGS) {
  const wanted = [...targets.values()].filter((t) => t.lang === lang)
  if (!wanted.length) continue
  const got = await fetchWikitext(`${lang}.wikiquote.org`, wanted.map((t) => t.title))
  for (const [title, text] of Object.entries(got)) pages[`${lang}|${title}`] = text
  console.log(`${lang}: fetched ${Object.values(got).filter(Boolean).length}/${wanted.length} pages`)
}

await writeJson('data/raw/native-targets.json', [...targets.values()])
await writeJson('data/raw/native-thinkers.json', newThinkers)
await writeJson('data/raw/native-pages.json', pages)
