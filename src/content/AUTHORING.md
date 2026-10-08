# Writing a "Thoughts" profile

A profile is one object in a `Profile[]` array (see `types.ts`). Each file in this folder exports one array, and
`profiles.ts` lists them. Read `types.ts` and `presocratic.ts` first: `presocratic.ts` holds five finished profiles that
set the exact structure, tone, depth and length to match.

## Fields and sizes

| Field | What to write |
| --- | --- |
| `slug` | Exactly the slug you were given (it links the profile to the thinker's quotes in the archive). |
| `order` | Approximate birth year (negative for BC). Use a sensible estimate if unknown. |
| `dates` | Display string, e.g. `'1724 – 1804'` or `'c. 570 – c. 495 BC'`. Verify; do not trust the dates in your brief blindly. |
| `place` | Where they lived and worked, e.g. `'Königsberg, Prussia'`. |
| `era` | Exactly the era you were given. |
| `tradition` | Short school/tradition label shown on the card, e.g. `'German idealism'`. |
| `tagline` | One sentence that captures the person. |
| `who` | 3 paragraphs: the life story (about 80-120 words each). |
| `context` | 2 paragraphs: the historical, political and intellectual setting. |
| `ideas` | 5 items `{ title, text }`, each text 2-4 sentences explaining the idea clearly. |
| `principles` | 5 short principles to live by. |
| `practice` | 3 concrete ways to apply the ideas today. |
| `facts` | 5-6 interesting, verifiable facts. |
| `myths` | 2-3 items `{ myth, reality }` correcting common misunderstandings or misattributed quotes. |
| `works` | 4-5 items `{ title, note }`: main writings and the sources we rely on. |
| `legacy` | 2 paragraphs on influence and what came after. |

Aim for roughly 1,000-1,400 words of prose per profile.

## Accuracy rules (the most important part)

- Verify dates, places, titles and every specific claim with WebSearch / WebFetch against reliable sources: Wikipedia,
  the Stanford Encyclopedia of Philosophy (plato.stanford.edu), the Internet Encyclopedia of Philosophy (iep.utm.edu),
  Britannica, and for non-Western or Georgian figures also sources in their own language where you can read them.
  Cross-check anything surprising.
- Where evidence is late, legendary or disputed, say so ("tradition says", "according to ...", "scholars debate").
  Never present a legend as fact.
- Never invent facts, quotations, titles, dates or numbers. If you are unsure, leave the claim out.
- Write in your own words. Do not copy sentences from sources. Short famous phrases are fine when the attribution
  is verified; do not reproduce long passages of copyrighted translations.
- Be balanced and factual about anything controversial (political, religious, personal, or about misuse of someone's
  ideas). State facts neutrally in the relevant section. No hagiography and no polemic.
- Plain, engaging English for general readers. Explain technical terms briefly.

## Format rules (the file must compile)

- Start with `import type { Profile } from './types'` and `export const NAME: Profile[] = [ ... ]`.
- Every string is a single-quoted JavaScript string on one line. Use the typographic apostrophe `’` for apostrophes
  (Kant’s) and curly quotes `“ ”` for quotations. Never put a straight `'` inside a string. No template literals, no
  line breaks inside strings. Non-Latin text (Georgian, Greek, Chinese, Arabic...) is fine inside strings.
- Do not modify any file other than your own. Do not run git commands or npm install.

## Checking your work

```
cd /Users/ggnadirashvili/dev/MindArchive && npx tsc --noEmit --ignoreConfig --skipLibCheck --target es2023 --module esnext --moduleResolution bundler --strict src/content/<your-file>.ts
```

Fix every error. Then reply with a short report: the file, the thinkers done, and the claims you were unsure about.
