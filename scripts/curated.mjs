// Hand-curated thinkers (not on English Wikiquote) live in scripts/curated/*.json as
// { thinker: {...Wikidata-style record}, quotes: [{ text, orig?, source, attributed, translated, featured }] }.
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'

const DIR = 'scripts/curated'

export async function loadCurated() {
  if (!existsSync(DIR)) return []
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'))
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(`${DIR}/${f}`, 'utf8'))))
}
