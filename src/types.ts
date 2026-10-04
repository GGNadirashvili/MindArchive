export interface Category {
  id: string
  name: string
}

export interface Philosopher {
  i: number
  slug: string
  name: string
  desc: string
  born: number | null
  died: number | null
  era: string
  country: string
  continent: string
  schools: string[]
  img: string | null
  wiki: string | null
  wq: string
  sep: string | null
  iep: string | null
  n: number
}

export interface Meta {
  generated: string
  shards: number
  shardSize: number
  quoteCount: number
  categories: Category[]
  philosophers: Philosopher[]
}

export interface Quote {
  id: number
  p: number
  text: string
  source: string
  cats: number[]
  publicDomain: boolean
  /** lowercased text + author + source, for search */
  hay: string
}

export type SortKey = 'renown' | 'philosopher' | 'country' | 'category' | 'era' | 'shortest' | 'longest' | 'shuffle'

export interface Filters {
  query: string
  cats: Set<number>
  countries: Set<string>
  eras: Set<string>
  philosophers: Set<number>
  saved: boolean
}
