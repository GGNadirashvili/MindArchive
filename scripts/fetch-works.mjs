// Finds works (books, dialogues, essays) written by our thinkers that have their own Wikiquote
// page. Famous lines like "The unexamined life is not worth living" live on those pages.
import { chunk, fetchJson, readJson, sleep, sparql, val, writeJson } from './lib.mjs'

const philosophers = await readJson('data/raw/philosophers.json')
const out = new Map()

for (const [i, group] of chunk(philosophers.map((p) => p.id), 150).entries()) {
  const rows = await sparql(`
    SELECT ?author ?workLabel ?title WHERE {
      VALUES ?author { ${group.map((id) => 'wd:' + id).join(' ')} }
      ?work wdt:P50 ?author .
      ?s schema:about ?work ; schema:isPartOf <https://en.wikiquote.org/> ; schema:name ?title .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`)
  for (const r of rows) {
    const pid = val(r, 'author').split('/').pop()
    out.set(`${pid}|${val(r, 'title')}`, { pid, title: val(r, 'title'), label: val(r, 'workLabel') })
  }
  process.stdout.write(`\rchunk ${i + 1}/${Math.ceil(philosophers.length / 150)}`)
  await sleep(700)
}

// Second source: Wikiquote's own "Works by <author>" categories (covers works Wikidata does not link).
const api = (params) => `https://en.wikiquote.org/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
const byWikiquoteTitle = new Map(philosophers.map((p) => [p.wikiquote, p]))
const worksCategories = []
for (let cont = {}; cont; ) {
  const json = await fetchJson(api({ action: 'query', list: 'allcategories', acprefix: 'Works by ', aclimit: '500', ...cont }))
  worksCategories.push(...json.query.allcategories.map((c) => c.category))
  cont = json.continue ?? null
}
let fromCategories = 0
for (const name of worksCategories) {
  const author = byWikiquoteTitle.get(name.replace(/^Works by /, ''))
  if (!author) continue
  const json = await fetchJson(api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${name}`, cmlimit: '500', cmnamespace: '0' }))
  for (const m of json.query.categorymembers) {
    const key = `${author.id}|${m.title}`
    if (!out.has(key)) {
      out.set(key, { pid: author.id, title: m.title, label: m.title })
      fromCategories++
    }
  }
  await sleep(150)
}
console.log(`\n+${fromCategories} works from ${worksCategories.length} "Works by" categories`)

// Wikiquote pages about Wikipedia/Citizendium themselves etc. are not works of thought.
const works = [...out.values()].filter((w) => !/^(Wikipedia|Citizendium|Everything2)$/i.test(w.title))
await writeJson('data/raw/works.json', works)
console.log(`\n${works.length} work pages for ${new Set(works.map((w) => w.pid)).size} thinkers`)
