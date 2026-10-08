// Sanity checks for the Thoughts profiles: every slug exists in the archive, every section is filled,
// and the text has no straight apostrophes left over or obviously broken characters.
import { readFile } from 'node:fs/promises'

const meta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const slugs = new Set(meta.philosophers.map((p) => p.slug))

import { loadContentGroups } from './content-modules.mjs'

const PROFILES = (await loadContentGroups()).flatMap((g) => g.profiles)

const wordCount = (p) => JSON.stringify(p).replace(/[{}[\]":,]/g, ' ').split(/\s+/).filter(Boolean).length
let problems = 0
const seen = new Set()
for (const p of PROFILES) {
  const issues = []
  if (!slugs.has(p.slug)) issues.push('slug not in archive')
  if (seen.has(p.slug)) issues.push('duplicate slug')
  seen.add(p.slug)
  const min = { who: 3, context: 2, ideas: 4, principles: 4, practice: 3, facts: 4, myths: 2, works: 3, legacy: 2 }
  for (const [k, n] of Object.entries(min)) if (!Array.isArray(p[k]) || p[k].length < n) issues.push(`${k} has ${p[k]?.length ?? 0} (< ${n})`)
  const text = JSON.stringify(p)
  if (/[A-Za-z]'[A-Za-z]/.test(text.replace(/\\"/g, ''))) issues.push("straight apostrophe in text")
  if (/\bTODO\b|lorem|undefined|\[object/i.test(text)) issues.push('placeholder text')
  if (issues.length) {
    problems++
    console.log(`✗ ${p.slug}: ${issues.join('; ')}`)
  }
}
console.log(`${PROFILES.length} profiles, ${PROFILES.reduce((n, p) => n + wordCount(p), 0).toLocaleString()} words, ${problems} with problems`)
console.log(PROFILES.map((p) => `${p.slug}:${wordCount(p)}`).join('  '))
process.exit(problems ? 1 : 0)
