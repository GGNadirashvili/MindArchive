// Downloads the (non-hidden) English Wikipedia categories of each thinker's article.
// Categories like "Stoic philosophers" or "Existentialists" feed the school-of-thought filter.
import { chunk, fetchJson, readJson, sleep, writeJson } from './lib.mjs'

const philosophers = await readJson('data/raw/philosophers.json')
const titles = [...new Set(philosophers.map((p) => p.wikipedia).filter(Boolean))]
const result = {}

for (const [i, group] of chunk(titles, 40).entries()) {
  const params = {
    action: 'query',
    prop: 'categories',
    cllimit: 'max',
    clshow: '!hidden',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    titles: group.join('|'),
  }
  const redirects = new Map()
  const normalized = new Map()
  const cats = new Map()
  let cont = {}
  do {
    const json = await fetchJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ ...params, ...cont })}`)
    for (const r of json.query?.redirects ?? []) redirects.set(r.from, r.to)
    for (const r of json.query?.normalized ?? []) normalized.set(r.from, r.to)
    for (const page of json.query?.pages ?? []) {
      const list = cats.get(page.title) ?? []
      for (const c of page.categories ?? []) list.push(c.title.replace(/^Category:/, ''))
      cats.set(page.title, list)
    }
    cont = json.continue ?? null
    if (cont) await sleep(150)
  } while (cont)

  for (const t of group) {
    const n = normalized.get(t) ?? t
    result[t] = cats.get(redirects.get(n) ?? n) ?? []
  }
  process.stdout.write(`\rbatch ${i + 1}/${Math.ceil(titles.length / 40)}`)
  await sleep(200)
}

await writeJson('data/raw/wikipedia-categories.json', result)
console.log(`\n${Object.values(result).filter((c) => c.length).length}/${titles.length} articles with categories`)
