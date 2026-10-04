// Role classifier: reads a thinker's Wikidata description ("French philosopher and writer")
// and returns every role it mentions, in order of first mention (the first is the primary role).
export const ROLES = [
  { id: 'philosopher', name: 'Philosopher', re: /philosoph|logician|metaphysic|ethicist|stoic|epistemolog|existential|phenomenolog|\bsage\b|thinker/i },
  { id: 'scientist', name: 'Scientist & Mathematician', re: /scientist|physicist|chemist|biologist|astronomer|naturalist|mathematic|geolog|engineer|neuroscien|computer|inventor|cosmolog|astrolog|polymath|physician|zoolog|botanist|doctor|surgeon|medic|ethologist|ecolog|geograph|archaeolog|neuro/i },
  { id: 'social', name: 'Social Scientist', re: /sociolog|economist|psycholog|anthropolog|psychoanalyst|psychiatrist|linguist|political scientist|(political|social|critical|cultural) theorist|semiotic|behaviorist|consultant/i },
  { id: 'writer', name: 'Writer & Poet', re: /writer|author|poet|novelist|essayist|playwright|dramatist|critic|journalist|editor|publicist|translator|literary|aphorist|satirist|orator|rhetorician|storyteller|fabulist|lyricist|screenwriter/i },
  { id: 'religious', name: 'Theologian & Spiritual Leader', re: /theolog|bishop|priest|monk|saint|mystic|rabbi|cardinal|pope|cleric|imam|guru|yogi|sufi|apologist|friar|jesuit|spiritual|religious|buddha|prophet|preacher|missionary|swami|christian|zen|deity|\bgod\b|hindu|muslim|islamic|caliph|\bnun\b|canon regular|spiritism|buddhis/i },
  { id: 'politics', name: 'Statesman & Jurist', re: /politician|statesman|president|diplomat|prime minister|jurist|lawyer|judge|legal|advocate|senator|emperor|king|military|general|soldier|revolutionary|chairman|leader|minister|governor|commander|head of state|investor|philanthropist|businessman|entrepreneur|queen|tyrant|ruler|assassin/i },
  { id: 'activist', name: 'Activist & Reformer', re: /activist|feminist|anarchist|reformer|abolition|campaigner|nationalist|socialist|marxist|humanitarian|pacifist|suffrag/i },
  { id: 'scholar', name: 'Scholar & Educator', re: /historian|scholar|academic|professor|teacher|educator|lecturer|indolog|philolog|orientalist|sinolog|classicist|librarian|intellectual/i },
  { id: 'artist', name: 'Artist & Musician', re: /painter|musician|composer|artist|architect|sculptor|filmmaker|photographer|singer/i },
]
export const OTHER_ROLE = { id: 'other', name: 'Other thinkers' }

/** @returns {number[]} indexes into ROLES (+ ROLES.length for "other"), primary role first. */
export function classifyRoles(description) {
  const text = description.replace(/\(.*?\)/g, '')
  const hits = ROLES.map((r, i) => ({ i, at: text.search(r.re) })).filter((h) => h.at !== -1)
  hits.sort((a, b) => a.at - b.at || a.i - b.i)
  return hits.length ? hits.slice(0, 3).map((h) => h.i) : [ROLES.length]
}
