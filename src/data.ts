import type { Meta, Quote } from './types'

const base = import.meta.env.BASE_URL

export async function loadMeta(): Promise<Meta> {
  const res = await fetch(`${base}data/meta.json`)
  if (!res.ok) throw new Error(`Could not load archive index (${res.status})`)
  return res.json()
}

type Row = [number, string, string, number[], number]

/** Loads quote shards in parallel and reports each as soon as it is ready. */
export async function loadShards(meta: Meta, onShard: (quotes: Quote[]) => void): Promise<void> {
  await Promise.all(
    Array.from({ length: meta.shards }, async (_, shard) => {
      const res = await fetch(`${base}data/quotes-${shard}.json`)
      if (!res.ok) throw new Error(`Could not load quotes (${res.status})`)
      const rows: Row[] = await res.json()
      const quotes = rows.map(([p, text, source, cats, pd], i): Quote => ({
        id: shard * meta.shardSize + i,
        p,
        text,
        source,
        cats,
        publicDomain: pd === 1,
        hay: `${text} ${meta.philosophers[p].name} ${source}`.toLowerCase(),
      }))
      onShard(quotes)
    }),
  )
}
