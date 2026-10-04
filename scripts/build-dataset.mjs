// Merges philosophers + quotes from every source into the compact JSON the site loads.
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { CATEGORIES, classify } from './categories.mjs'
import { readJson, writeJson } from './lib.mjs'

const OUT = 'public/data'
const SHARD_SIZE = 4000
const FALLBACK = CATEGORIES.length // "Reflections" – quotes no keyword matched

const COUNTRY_ALIASES = {
  'United States of America': 'United States',
  'United Kingdom of Great Britain and Ireland': 'United Kingdom',
  "People's Republic of China": 'China',
  'Kingdom of Italy': 'Italy',
}

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
  const country = COUNTRY_ALIASES[p.country] ?? p.country ?? COUNTRY_ALIASES[p.citizenship] ?? p.citizenship ?? 'Unknown'
  return {
    i,
    slug,
    name: p.name,
    desc: p.description,
    born: p.born,
    died: p.died,
    era: eraOf(p.born),
    country,
    continent: p.continent ?? 'Unknown',
    schools: p.movements.slice(0, 3),
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
  quoteCount: rows.length,
  categories: [...CATEGORIES.map((c) => ({ id: c.id, name: c.name })), { id: 'reflections', name: 'Reflections' }],
  philosophers: outPhilosophers,
})
const catCount = new Array(CATEGORIES.length + 1).fill(0)
for (const r of rows) for (const c of r[3]) catCount[c]++
console.log(`${outPhilosophers.length} philosophers, ${rows.length} quotes, ${shards.length} shards`)
console.log(CATEGORIES.map((c, i) => `${c.name}: ${catCount[i]}`).concat(`Reflections: ${catCount[FALLBACK]}`).join('\n'))
