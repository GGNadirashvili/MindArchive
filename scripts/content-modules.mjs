// Loads the TypeScript "Thoughts" content files from plain Node by transpiling them to a temp folder.
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const SKIP = new Set(['types.ts', 'registry.ts'])

/** @returns {Promise<{ file: string, exportName: string, profiles: any[] }[]>} one entry per content file */
export async function loadContentGroups() {
  const dir = await mkdtemp(join(tmpdir(), 'mindarchive-content-'))
  const files = (await readdir('src/content')).filter((f) => f.endsWith('.ts') && !SKIP.has(f)).sort()
  for (const file of files) {
    const source = await readFile(`src/content/${file}`, 'utf8')
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    await writeFile(join(dir, file.replace(/\.ts$/, '.mjs')), outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
  }
  const groups = []
  for (const file of files) {
    const mod = await import(pathToFileURL(join(dir, file.replace(/\.ts$/, '.mjs'))).href)
    for (const [exportName, value] of Object.entries(mod)) {
      if (Array.isArray(value) && value.every((p) => p && typeof p.slug === 'string')) groups.push({ file: file.replace(/\.ts$/, ''), exportName, profiles: value })
    }
  }
  return groups
}
