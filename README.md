# MindArchive

A searchable space of philosophers' quotes and thoughts, drawn from every era and tradition.
Black background, white text, green accents. Filter by topic, era, country or philosopher, and
sort by category or by the philosopher's country.

Built with React + TypeScript + Vite and deployed as a static site on GitHub Pages.

## How it works

Everything the site shows is generated offline by the scripts in [`scripts/`](scripts) and shipped
as static JSON in `public/data/`. There is no backend.

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `fetch-philosophers.mjs` | Queries Wikidata for philosophers who have a Wikiquote page: dates, country of birth (mapped to a modern country), schools, SEP/IEP ids, renown (sitelink count). |
| 2 | `fetch-wikiquote.mjs`, `parse-wikiquote.mjs` | Downloads each Wikiquote page and extracts sourced quotes, dropping disputed/misattributed sections, non-English text and editorial notes. |
| 3 | `fetch-gutenberg.mjs` | Pulls short, self-contained passages from public-domain philosophy texts on Project Gutenberg. |
| 4 | `build-dataset.mjs` | Merges sources, de-duplicates, assigns topic categories with a keyword classifier (`categories.mjs`), and writes sharded JSON. |

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
