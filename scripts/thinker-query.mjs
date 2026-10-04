// Shared Wikidata lookup: turns a list of Wikidata ids into thinker records
// (dates, country of birth, schools, encyclopedia ids...). Used for English and native-language Wikiquote.
import { sparql, val } from './lib.mjs'

/**
 * @param {string[]} ids Wikidata ids (Q...)
 * @param {string} host Wikiquote edition the thinker must have a page on, e.g. "en.wikiquote.org"
 *   (null = do not require a Wikidata sitelink; the caller supplies page titles)
 */
export const detailQuery = (ids, host) => `
SELECT ?p ?pLabel ?pDescription
  (SAMPLE(?birth) AS ?birthD) (SAMPLE(?death) AS ?deathD)
  (SAMPLE(?quoteTitle) AS ?wq) (SAMPLE(?wikiTitle) AS ?wp)
  (SAMPLE(?img) AS ?image) (SAMPLE(?sep) AS ?sepId) (SAMPLE(?iep) AS ?iepId)
  (SAMPLE(?links) AS ?sitelinks) (SAMPLE(?cLabel) AS ?country) (SAMPLE(?contLabel) AS ?continent) (SAMPLE(?citLabel) AS ?citizenship)
  (GROUP_CONCAT(DISTINCT ?mvLabel; separator="|") AS ?movements)
  (GROUP_CONCAT(DISTINCT ?fieldLabel; separator="|") AS ?fields)
WHERE {
  VALUES ?p { ${ids.map((i) => 'wd:' + i).join(' ')} }
  ${host ? `?sq schema:about ?p ; schema:isPartOf <https://${host}/> ; schema:name ?quoteTitle .` : ''}
  OPTIONAL { ?wpArt schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?wikiTitle . }
  OPTIONAL { ?p wikibase:sitelinks ?links }
  OPTIONAL { ?p wdt:P569 ?birth }
  OPTIONAL { ?p wdt:P570 ?death }
  OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?p wdt:P3123 ?sep }
  OPTIONAL { ?p wdt:P5088 ?iep }
  OPTIONAL {
    ?p wdt:P19 ?bp . ?bp wdt:P17 ?c . ?c rdfs:label ?cLabel . FILTER(LANG(?cLabel) = "en")
    OPTIONAL { ?c wdt:P30 ?cont . ?cont rdfs:label ?contLabel . FILTER(LANG(?contLabel) = "en") }
  }
  OPTIONAL { ?p wdt:P27 ?cit . ?cit rdfs:label ?citLabel . FILTER(LANG(?citLabel) = "en") }
  OPTIONAL { ?p wdt:P135 ?mv . ?mv rdfs:label ?mvLabel . FILTER(LANG(?mvLabel) = "en") }
  OPTIONAL { ?p wdt:P101 ?fl . ?fl rdfs:label ?fieldLabel . FILTER(LANG(?fieldLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?p ?pLabel ?pDescription`

const year = (iso) => {
  if (!iso) return null
  const m = /^(-?)0*(\d+)-/.exec(iso)
  return m ? (m[1] ? -Number(m[2]) : Number(m[2])) : null
}

const list = (s) => (s ? s.split('|').filter(Boolean) : [])

/** Fetches thinker records for the given ids; `lang` is stored when the Wikiquote page is not English. */
export async function fetchThinkers(ids, host, lang, titles = new Map()) {
  const rows = await sparql(detailQuery(ids, host))
  return rows.map((r) => ({
    id: val(r, 'p').split('/').pop(),
    name: val(r, 'pLabel'),
    description: val(r, 'pDescription') ?? '',
    born: year(val(r, 'birthD')),
    died: year(val(r, 'deathD')),
    sitelinks: Number(val(r, 'sitelinks') ?? 0),
    wikiquote: val(r, 'wq') ?? titles.get(val(r, 'p').split('/').pop()),
    ...(lang ? { wikiquoteLang: lang } : {}),
    wikipedia: val(r, 'wp') ?? null,
    image: val(r, 'image') ?? null,
    sep: val(r, 'sepId') ?? null,
    iep: val(r, 'iepId') ?? null,
    country: val(r, 'country') ?? null,
    continent: val(r, 'continent') ?? null,
    citizenship: val(r, 'citizenship') ?? null,
    movements: list(val(r, 'movements')),
    fields: list(val(r, 'fields')),
  }))
}
