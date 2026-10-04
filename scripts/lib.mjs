// Shared helpers for the data pipeline.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const UA = 'MindArchive/0.1 (https://github.com/GGNadirashvili/MindArchive; giorgi@coinmania.ge)'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function fetchJson(url, { retries = 5, headers = {} } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.json()
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(1500 * 2 ** attempt)
    }
  }
}

export async function fetchText(url, { retries = 5 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(1500 * 2 ** attempt)
    }
  }
}

export async function sparql(query) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query)
  const json = await fetchJson(url, { headers: { Accept: 'application/sparql-results+json' } })
  return json.results.bindings
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data))
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export const chunk = (arr, size) => {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export const val = (row, key) => row[key]?.value
