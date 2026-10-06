// Shape of a "Thoughts" profile. `slug` matches the thinker's slug in the archive, so profiles
// link to their quotes. Claims that rest on tradition are worded that way ("tradition says",
// "according to…"), because ancient sources are often late or legendary.

export type Era = 'Ancient' | 'Medieval' | 'Early Modern' | 'Enlightenment' | '19th Century' | '20th Century'

export const ERAS: Era[] = ['Ancient', 'Medieval', 'Early Modern', 'Enlightenment', '19th Century', '20th Century']

export interface Idea {
  title: string
  text: string
}

export interface Myth {
  myth: string
  reality: string
}

export interface Work {
  title: string
  note: string
}

export interface Profile {
  slug: string
  /** Sort key: approximate year of birth (negative = BC) */
  order: number
  dates: string
  place: string
  /** Broad period, used for the gallery filter */
  era: Era
  /** Short school or tradition label shown on the card, e.g. "Stoicism" or "Islamic philosophy" */
  tradition: string
  tagline: string
  /** Life story, in short paragraphs */
  who: string[]
  /** The historical setting */
  context: string[]
  ideas: Idea[]
  principles: string[]
  /** How to apply the ideas today */
  practice: string[]
  facts: string[]
  myths: Myth[]
  /** Writings, and the sources we rely on */
  works: Work[]
  /** Influence and legacy, in short paragraphs */
  legacy: string[]
}
