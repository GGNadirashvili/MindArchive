// Extracts self-contained, aphorism-like passages from public-domain philosophy
// texts on Project Gutenberg (located through the official catalog CSV).
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fetchText, readJson, sleep, writeJson } from './lib.mjs'

const CATALOG_URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv'
const CATALOG_PATH = 'data/raw/pg_catalog.csv'

// Minimal RFC 4180 parser (the catalog has quoted, multi-line fields).
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  return rows
}

async function loadCatalog() {
  if (!existsSync(CATALOG_PATH)) await writeFile(CATALOG_PATH, await fetchText(CATALOG_URL))
  const [, ...rows] = parseCsv(await readFile(CATALOG_PATH, 'utf8'))
  return rows
    .filter((r) => r[1] === 'Text' && r[4] === 'en')
    .map((r) => ({ id: Number(r[0]), title: r[3].replace(/\s*\n\s*/g, ' '), authors: r[5] }))
}

// [philosopher name in our dataset, catalog author regex, catalog title regex]
const WORKS = [
  ['Marcus Aurelius', /aurelius/i, /^meditations/i],
  ['Epictetus', /epictetus/i, /golden sayings|enchiridion|discourses/i],
  ['Seneca', /seneca, lucius annaeus/i, /morals|letters|shortness|benefits/i],
  ['Friedrich Nietzsche', /nietzsche/i, /beyond good and evil|thus spake|twilight of the idols|human, all too human|joyful wisdom|genealogy of morals|antichrist|dawn of day|will to power/i],
  ['Arthur Schopenhauer', /schopenhauer/i, /wisdom of life|counsels and maxims|essays|studies in pessimism|art of literature|world as will/i],
  ['Blaise Pascal', /pascal, blaise/i, /thoughts|pensées/i],
  ['Francis Bacon', /bacon, francis/i, /essays|new atlantis|advancement of learning/i],
  ['Ralph Waldo Emerson', /emerson/i, /essays|conduct of life|nature|representative men/i],
  ['Henry David Thoreau', /thoreau/i, /walden|civil disobedience|life without principle/i],
  ['Benedictus de Spinoza', /spinoza/i, /^ethic|theologico|improvement of the understanding/i],
  ['David Hume', /hume, david/i, /enquiry|treatise of human nature|essays/i],
  ['Immanuel Kant', /kant, immanuel/i, /practical reason|metaphysic of morals|pure reason|judgment|perpetual peace|prolegomena/i],
  ['Plato', /plato/i, /republic|symposium|apology|phaedo|phaedrus|gorgias|laws|crito|theaetetus|meno/i],
  ['Aristotle', /aristotle/i, /nicomachean|politics|poetics|rhetoric|metaphysics/i],
  ['René Descartes', /descartes/i, /discourse on|meditations|principles of philosophy/i],
  ['John Stuart Mill', /mill, john stuart/i, /on liberty|utilitarianism|subjection of women|representative government/i],
  ['Jean-Jacques Rousseau', /rousseau, jean-jacques/i, /social contract|discourse|emile|confessions/i],
  ['Thomas Hobbes', /hobbes, thomas/i, /leviathan/i],
  ['Niccolò Machiavelli', /machiavelli/i, /the prince|discourses/i],
  ['Laozi', /lao-?tzu|laozi|lao tse|laotse/i, /tao|tâo/i],
  ['Confucius', /confucius/i, /analects|sayings|doctrine of the mean|great learning/i],
  ['Sun Tzu', /sunzi|sun tzu|sun wu/i, /art of war/i],
  ['Boethius', /boethius/i, /consolation/i],
  ['William James', /james, william/i, /pragmatism|varieties of religious|will to believe|talks to teachers/i],
  ['Bertrand Russell', /russell, bertrand/i, /problems of philosophy|mysticism and logic|analysis of mind|proposed roads/i],
  ['George Berkeley', /berkeley, george/i, /principles|dialogues/i],
  ['Cicero', /cicero/i, /duties|friendship|old age|nature of the gods|tusculan/i],
  ['Lucretius', /lucretius/i, /nature of things/i],
  ['Michel de Montaigne', /montaigne/i, /essays/i],
  ['Voltaire', /voltaire/i, /philosophical dictionary/i],
  ['Søren Kierkegaard', /kierkegaard/i, /./],
  ['Ludwig Feuerbach', /feuerbach/i, /./],
  ['Adam Smith', /smith, adam/i, /moral sentiments/i],
  ['Epicurus', /epicurus/i, /./],
  ['Plutarch', /plutarch/i, /morals|essays/i],
  ['Xenophon', /xenophon/i, /memorabilia|socrates/i],
  ['Thomas Aquinas', /aquinas/i, /summa/i],
  ['Augustine of Hippo', /augustine/i, /confessions|city of god/i],
  ['John Locke', /locke, john/i, /human understanding|government|education/i],
  ['Gottfried Wilhelm Leibniz', /leibni[tz]/i, /./],
  ['Herbert Spencer', /spencer, herbert/i, /education|first principles|man versus/i],
  ['Mary Wollstonecraft', /wollstonecraft/i, /vindication/i],
  ['Georg Wilhelm Friedrich Hegel', /hegel/i, /./],
  ['Max Stirner', /stirner/i, /./],
  ['Karl Marx', /marx, karl/i, /manifesto|capital|value, price/i],
  ['Henri Bergson', /bergson/i, /./],
  ['Edmund Burke', /burke, edmund/i, /sublime|reflections/i],
  ['Thomas Paine', /paine, thomas/i, /rights of man|common sense|age of reason/i],
  ['Giordano Bruno', /bruno, giordano/i, /./],
  ['Averroes', /averroes|ibn rushd/i, /./],
  ['Al-Ghazali', /ghazali/i, /./],
]

const MAX_PER_WORK = 90
const MAX_BOOKS_PER_ENTRY = 3
const MAX_PER_PHILOSOPHER = 320
const BAD_START = /^(however|but|and|for|therefore|thus|hence|so|this|these|that|such|it|he|she|they|yet|now|then|if so|moreover|also|again|here|there|thou|his|her|their|its|him|them|those|the same|in this|in that|which|whereas|nor|or|i answer|we have|let us)\b/i
// Phrases that only make sense with the surrounding text.
const CONTEXTUAL = /\b(as we go on|as I have|we have (seen|said|shown)|we shall (see|find|show)|I have (said|shown|already)|the foregoing|aforesaid|above|below|this (chapter|book|section|essay|treatise|preface|volume|work)|the (reader|translator|author|editor)|preface|footnote|dr\. |mr\. |mrs\. |Q\.|Ans\.)\b/i
const BAD_ANY = /\b(chapter|book [ivx]+|section|footnote|fig\.|ibid|translator|editor|gutenberg|vol\.)\b|\[|\]|_|\d|;;/i

// Gutenberg paragraphs are hard-wrapped; undo the wrapping and drop headers/notes.
function paragraphsOf(raw) {
  const start = raw.search(/\*\*\* ?START OF/)
  const end = raw.search(/\*\*\* ?END OF/)
  const body = raw.slice(start === -1 ? 0 : raw.indexOf('\n', start), end === -1 ? undefined : end)
  return body
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .filter((p) => {
      // Hard-wrapped prose has long, even lines; verse and tables of contents do not.
      const lines = p.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) return true
      const avg = lines.reduce((n, l) => n + l.length, 0) / lines.length
      return avg >= 52
    })
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
}

const isGood = (p) => {
  if (p.length < 70 || p.length > 420) return false
  if (!/[.!?]["”’']?$/.test(p)) return false
  // Must open like prose; a leading quotation mark usually means dialogue.
  if (!/^[A-Z]/.test(p)) return false
  if (BAD_START.test(p) || BAD_ANY.test(p) || CONTEXTUAL.test(p)) return false
  if (/^([IVXLC]+|[A-Z]{2,6}|\d+)[.:)]\s/.test(p)) return false
  if (p === p.toUpperCase()) return false
  const sentences = p.split(/(?<=[.!?])\s+/)
  if (sentences.length > 4) return false
  const quotes = (p.match(/["“”]/g) ?? []).length
  if (quotes % 2 === 1) return false
  const letters = p.replace(/[^A-Za-z]/g, '')
  return letters.length / p.length > 0.78
}

const philosophers = await readJson('data/raw/philosophers.json')
const idByName = new Map(philosophers.map((p) => [p.name, p.id]))

const catalog = await loadCatalog()
const out = []
const used = new Set()
const perPhilosopher = new Map()

for (const [name, authorRe, titleRe] of WORKS) {
  const pid = idByName.get(name)
  if (!pid) {
    console.log(`SKIP (philosopher not in dataset): ${name}`)
    continue
  }
  const matches = catalog
    .filter((b) => authorRe.test(b.authors) && titleRe.test(b.title) && !used.has(b.id) && !/\b(commentary|life of|study of|introduction)\b/i.test(b.title))
    .slice(0, MAX_BOOKS_PER_ENTRY)
  if (!matches.length) console.log(`NOT FOUND: ${name} / ${titleRe}`)
  for (const book of matches) {
    used.add(book.id)
    if ((perPhilosopher.get(pid) ?? 0) >= MAX_PER_PHILOSOPHER) break
    try {
      const text = await fetchText(`https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`)
      const good = paragraphsOf(text).filter(isGood)
      // Sample evenly so the picks span the whole work.
      const step = Math.max(1, Math.floor(good.length / MAX_PER_WORK))
      const picked = good.filter((_, i) => i % step === 0).slice(0, MAX_PER_WORK)
      const title = book.title.replace(/;.*$/, '').trim()
      for (const p of picked) out.push({ pid, text: p, source: title })
      perPhilosopher.set(pid, (perPhilosopher.get(pid) ?? 0) + picked.length)
      console.log(`${name} — ${title} (#${book.id}): ${good.length} candidates, kept ${picked.length}`)
      await sleep(300)
    } catch (err) {
      console.log(`ERROR ${name} #${book.id}: ${err.message}`)
    }
  }
}

await writeJson('data/raw/quotes-gutenberg.json', out)
console.log(`\n${out.length} passages`)
