// Merges philosophers + quotes from every source into the compact JSON the site loads.
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { CATEGORIES, classify } from './categories.mjs'
import { readJson, writeJson } from './lib.mjs'
import { OTHER_ROLE, ROLES, classifyRoles } from './roles.mjs'
import { SCHOOLS, classifySchools } from './schools.mjs'

const OUT = 'public/data'
const SHARD_SIZE = 4000
const FALLBACK = CATEGORIES.length // "Reflections" – quotes no keyword matched

// Historical / political entities -> the modern country they correspond to.
const COUNTRY_ALIASES = {
  'United States of America': 'United States',
  'United Kingdom of Great Britain and Ireland': 'United Kingdom',
  'Kingdom of England': 'United Kingdom',
  'British Empire': 'United Kingdom',
  'British Raj': 'India',
  'Gupta Empire': 'India',
  'Chola dynasty': 'India',
  'Shakya': 'Nepal',
  "People's Republic of China": 'China',
  'Zhou dynasty': 'China',
  'Ming dynasty': 'China',
  'Tang dynasty': 'China',
  'Eastern Han': 'China',
  'Qi': 'China',
  'Chu': 'China',
  'Lu': 'China',
  'Zhao': 'China',
  'Nguyen dynasty': 'Vietnam',
  'Empire of Japan': 'Japan',
  'Kingdom of Italy': 'Italy',
  'Ancient Rome': 'Italy',
  'Roman Empire': 'Italy',
  'Ancient Greece': 'Greece',
  'Ancient Egypt': 'Egypt',
  'Kingdom of Pergamon': 'Turkey',
  'Kingdom of Pontus': 'Turkey',
  'Byzantine Empire': 'Turkey',
  'Akkadian Empire': 'Iraq',
  'Kingdom of France': 'France',
  'Carolingian Empire': 'France',
  'Kingdom of Bohemia': 'Czech Republic',
  'Russian Empire': 'Russia',
  'Soviet Union': 'Russia',
  'Kingdom of the Netherlands': 'Netherlands',
  'Circassia': 'Russia',
}
const normCountry = (c) => (c ? COUNTRY_ALIASES[c] ?? c : null)

const eraOf = (born) => {
  if (born == null) return 'Unknown'
  if (born < 500) return 'Ancient'
  if (born < 1400) return 'Medieval'
  if (born < 1750) return 'Early Modern'
  if (born < 1880) return '19th Century'
  return 'Contemporary'
}

const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const philosophers = await readJson('data/raw/philosophers.json')
const wikiCategories = await readJson('data/raw/wikipedia-categories.json')
const sources = [{ file: 'data/raw/quotes-wikiquote.json', label: 'wikiquote' }]
if (existsSync('data/raw/quotes-gutenberg.json')) sources.push({ file: 'data/raw/quotes-gutenberg.json', label: 'gutenberg' })

const byPhilosopher = new Map()
const seen = new Set()
for (const src of sources) {
  for (const q of await readJson(src.file)) {
    const key = q.pid + '|' + q.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 120)
    if (seen.has(key)) continue
    seen.add(key)
    if (!byPhilosopher.has(q.pid)) byPhilosopher.set(q.pid, [])
    byPhilosopher.get(q.pid).push({ ...q, via: src.label })
  }
}

const kept = philosophers
  .filter((p) => byPhilosopher.has(p.id))
  .sort((a, b) => b.sitelinks - a.sitelinks || byPhilosopher.get(b.id).length - byPhilosopher.get(a.id).length)

const usedSlugs = new Set()
const outPhilosophers = kept.map((p, i) => {
  let slug = slugify(p.name) || p.id.toLowerCase()
  if (usedSlugs.has(slug)) slug += '-' + p.id.toLowerCase()
  usedSlugs.add(slug)
  const country = normCountry(p.country) ?? normCountry(p.citizenship) ?? 'Unknown'
  return {
    i,
    slug,
    name: /^Q\d+$/.test(p.name) ? p.wikiquote : p.name,
    desc: p.description,
    born: p.born,
    died: p.died,
    era: eraOf(p.born),
    roles: classifyRoles(p.description),
    country,
    continent: p.continent ?? 'Unknown',
    schools: classifySchools({ categories: wikiCategories[p.wikipedia] ?? [], movements: p.movements, description: p.description }),
    img: p.image ? p.image.replace(/^http:/, 'https:') + '?width=240' : null,
    wiki: p.wikipedia,
    wq: p.wikiquote,
    sep: p.sep,
    iep: p.iep,
    n: byPhilosopher.get(p.id).length,
  }
})

const indexById = new Map(kept.map((p, i) => [p.id, i]))
const rows = []
for (const p of kept) {
  for (const q of byPhilosopher.get(p.id)) {
    const cats = classify(q.text)
    rows.push([indexById.get(p.id), q.text, q.source ?? '', cats.length ? cats : [FALLBACK], q.via === 'gutenberg' ? 1 : 0])
  }
}

// Philosophers are ordered by renown, so the first shard holds the best-known thinkers.
await rm(OUT, { recursive: true, force: true })
const shards = []
for (let i = 0; i < rows.length; i += SHARD_SIZE) shards.push(rows.slice(i, i + SHARD_SIZE))
for (const [i, s] of shards.entries()) await writeJson(`${OUT}/quotes-${i}.json`, s)

await writeJson(`${OUT}/meta.json`, {
  generated: new Date().toISOString().slice(0, 10),
  shards: shards.length,
  shardSize: SHARD_SIZE,
  quoteCount: rows.length,
  schools: SCHOOLS.map((s) => ({ id: s.id, name: s.name })),
  roles: [...ROLES.map((r) => ({ id: r.id, name: r.name })), OTHER_ROLE],
  categories: [...CATEGORIES.map((c) => ({ id: c.id, name: c.name })), { id: 'reflections', name: 'Reflections' }],
  philosophers: outPhilosophers,
})
const catCount = new Array(CATEGORIES.length + 1).fill(0)
for (const r of rows) for (const c of r[3]) catCount[c]++
console.log(`${outPhilosophers.length} philosophers, ${rows.length} quotes, ${shards.length} shards`)
console.log(CATEGORIES.map((c, i) => `${c.name}: ${catCount[i]}`).concat(`Reflections: ${catCount[FALLBACK]}`).join('\n'))
