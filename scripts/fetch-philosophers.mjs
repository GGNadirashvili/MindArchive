// Collects philosophers from Wikidata (those with an English Wikiquote page),
// with birth/death, modern country (of birthplace), schools, and encyclopedia ids.
import { chunk, sparql, val, writeJson, sleep } from './lib.mjs'
import { fetchThinkers } from './thinker-query.mjs'

const OUT = 'data/raw/philosophers.json'

const LIST_QUERY = `
SELECT DISTINCT ?p WHERE {
  ?p wdt:P106 wd:Q4964182 .
  ?s schema:about ?p ; schema:isPartOf <https://en.wikiquote.org/> .
}`

const ids = (await sparql(LIST_QUERY)).map((r) => val(r, 'p').split('/').pop())
console.log(`${ids.length} philosophers with a Wikiquote page`)

const out = []
for (const [i, group] of chunk(ids, 80).entries()) {
  out.push(...(await fetchThinkers(group, 'en.wikiquote.org')))
  console.log(`  chunk ${i + 1}/${Math.ceil(ids.length / 80)} -> ${out.length}`)
  await sleep(1000)
}

await writeJson(OUT, out)
console.log(`wrote ${out.length} philosophers to ${OUT}`)
