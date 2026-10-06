# MindArchive

A searchable space of quotes and thoughts from thinkers (philosophers, scientists, writers, statesmen, spiritual leaders and more) of every era and tradition.
Black background, white text, green accents. Filter by topic, role, era, country or thinker, and
sort by category, role or the thinker's country.

Built with React + TypeScript + Vite and deployed as a static site on GitHub Pages.

## How it works

Everything the site shows is generated offline by the scripts in [`scripts/`](scripts) and shipped
as static JSON in `public/data/`. There is no backend.

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `fetch-philosophers.mjs` | Queries Wikidata for philosophers who have a Wikiquote page: dates, country of birth (mapped to a modern country), schools, SEP/IEP ids, renown (sitelink count). |
| 2 | `fetch-works.mjs`, `fetch-wikiquote.mjs`, `parse-wikiquote.mjs` | Downloads each thinker's Wikiquote page and the pages of their works (where famous lines like "The unexamined life is not worth living" live), extracts quotes, keeps Wikiquote's featured quotes first, flags attributed ones, and drops misattributed sections, non-English text and editorial notes. |
| 3 | `fetch-gutenberg.mjs` | Pulls short, self-contained passages from public-domain philosophy texts on Project Gutenberg. |
| 3b | `fetch-native.mjs`, `parse-native-wikiquote.mjs` | Native-language quotes: for each thinker, looks for a Wikiquote edition in the language they wrote in (Georgian for Rustaveli, Russian for Dostoevsky, plus German, French, Italian, Spanish and Polish) and keeps the original text, with no translation. Also adds Georgian authors that only have a Georgian page. |
| 4 | `scripts/curated/*.json` | Hand-curated thinkers who have no English Wikiquote page (e.g. Merab Mamardashvili, from Russian Wikiquote and cited articles), with original-language text and clearly labelled translations. |
| 5 | `build-dataset.mjs` | Merges sources, de-duplicates, assigns topic categories with a keyword classifier (`categories.mjs`), and writes sharded JSON. |

```bash
npm install
npm run data        # rebuild the dataset from the web (takes a while)
npm run dev         # local dev server
npm run build       # production build into dist/
```

## Sources and licensing

- Quotes: [Wikiquote](https://www.wikiquote.org), CC BY-SA 4.0.
- Philosopher metadata: [Wikidata](https://www.wikidata.org), CC0.
- Passages marked "Public domain": [Project Gutenberg](https://www.gutenberg.org) texts.
- Philosopher pages link out to the Stanford Encyclopedia of Philosophy and the Internet
  Encyclopedia of Philosophy rather than copying their text.

Topic categories are assigned automatically from keywords and are approximate.

The **Thoughts** section (`src/content/`) holds 100 long-form profiles, from Thales to Mamardashvili: life, historical context, main ideas, principles, ways to practise them, facts, myths versus reality, sources and legacy. The text is original to this project. Add more by creating a file in `src/content/` that exports `Profile[]` (see `types.ts`) and listing it in `profiles.ts`; `node scripts/check-profiles.mjs` validates them.

Word meanings (double-click or double-tap an English word) come from the [Wiktionary](https://en.wiktionary.org) definitions API, CC BY-SA.
