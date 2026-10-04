import type { Meta, Quote } from './types'

const base = import.meta.env.BASE_URL

export async function loadMeta(): Promise<Meta> {
  const res = await fetch(`${base}data/meta.json`)
  if (!res.ok) throw new Error(`Could not load archive index (${res.status})`)
  return res.json()
}

// flags: 1 = public domain passage, 2 = attributed/disputed, 4 = featured
type Row = [number, string, string, number[], number]

/** Loads quote shards in parallel and reports each as soon as it is ready. */
export async function loadShards(meta: Meta, onShard: (quotes: Quote[]) => void): Promise<void> {
  await Promise.all(
    Array.from({ length: meta.shards }, async (_, shard) => {
      const res = await fetch(`${base}data/quotes-${shard}.json`)
      if (!res.ok) throw new Error(`Could not load quotes (${res.status})`)
      const rows: Row[] = await res.json()
      const quotes = rows.map(([p, text, source, cats, flags], i): Quote => ({
        id: shard * meta.shardSize + i,
        p,
        text,
        source,
        cats,
        publicDomain: (flags & 1) !== 0,
        attributed: (flags & 2) !== 0,
        featured: (flags & 4) !== 0,
        hay: `${text} ${meta.philosophers[p].name} ${source}`.toLowerCase(),
      }))
      onShard(quotes)
    }),
  )
}
