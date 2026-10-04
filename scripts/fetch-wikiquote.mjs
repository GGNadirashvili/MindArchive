// Downloads the raw wikitext of each thinker's English Wikiquote page, plus the pages of their works.
import { existsSync } from 'node:fs'
import { chunk, fetchJson, readJson, sleep, writeJson } from './lib.mjs'

const philosophers = await readJson('data/raw/philosophers.json')
const works = existsSync('data/raw/works.json') ? await readJson('data/raw/works.json') : []
const titles = [...new Set([...philosophers.map((p) => p.wikiquote), ...works.map((w) => w.title)])]
const pages = {}

for (const [i, group] of chunk(titles, 15).entries()) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    titles: group.join('|'),
  })
  const json = await fetchJson(`https://en.wikiquote.org/w/api.php?${params}`)
  const redirects = new Map((json.query.redirects ?? []).map((r) => [r.from, r.to]))
  const normalized = new Map((json.query.normalized ?? []).map((r) => [r.from, r.to]))
  const byTitle = new Map(json.query.pages.map((p) => [p.title, p.revisions?.[0]?.slots?.main?.content ?? null]))
  for (const t of group) {
    const n = normalized.get(t) ?? t
    pages[t] = byTitle.get(redirects.get(n) ?? n) ?? null
  }
  process.stdout.write(`\rbatch ${i + 1}/${Math.ceil(titles.length / 15)}`)
  await sleep(300)
}

await writeJson('data/raw/wikiquote.json', pages)
const ok = Object.values(pages).filter(Boolean).length
console.log(`\nfetched ${ok}/${titles.length} pages`)
