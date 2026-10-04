// Schools of thought / movements. A thinker belongs to every school whose pattern matches one of
// their Wikipedia categories ("Stoic philosophers"), Wikidata movements, or their description.
export const SCHOOLS = [
  // Ancient
  { id: 'presocratic', name: 'Presocratic', re: /pre-?socratic/i },
  { id: 'sophism', name: 'Sophism', re: /sophists?\b/i },
  { id: 'platonism', name: 'Platonism', re: /platonis|platonic/i },
  { id: 'aristotelianism', name: 'Aristotelianism', re: /aristotelian|peripatetic/i },
  { id: 'stoicism', name: 'Stoicism', re: /stoic/i },
  { id: 'epicureanism', name: 'Epicureanism', re: /epicure/i },
  { id: 'skepticism', name: 'Skepticism', re: /pyrrhon|skeptic|sceptic/i },
  { id: 'cynicism', name: 'Cynicism', re: /\bcynic/i },
  // Religious & wisdom traditions
  { id: 'scholasticism', name: 'Scholasticism', re: /scholastic|thomis/i },
  { id: 'christian', name: 'Christian thought', re: /christian (philosoph|theolog|ethic|mystic|existential|humanist|socialist|apologist)|catholic philosoph|protestant (philosoph|theolog|mystic|reform)|anglican philosoph|lutheran (philosoph|theolog)|calvinist and reformed|reformed (philosoph|theolog)|augustinian philosoph|church fathers|apologists/i },
  { id: 'jewish', name: 'Jewish thought', re: /jewish philosoph|philosophers of judaism|kabbal|hasid|talmud/i },
  { id: 'islamic', name: 'Islamic & Sufi thought', re: /islamic philosoph|muslim philosoph|sufi|islamic theolog|muslim theolog|falsafa|ash'?ari/i },
  { id: 'hindu', name: 'Hindu & Vedanta', re: /hindu philosoph|vedanta|advait|hindu spiritual|hindu reform|hindu revival|\bhindu (monks|saints)/i },
  { id: 'buddhism', name: 'Buddhism', re: /buddhis|buddhist/i },
  { id: 'confucianism', name: 'Confucianism', re: /confuci/i },
  { id: 'taoism', name: 'Taoism', re: /\bta?oi?st|daois|taoism/i },
  { id: 'mysticism', name: 'Mysticism', re: /mystic/i },
  // Early modern
  { id: 'renaissance', name: 'Renaissance', re: /renaissance/i },
  { id: 'rationalism', name: 'Rationalism', re: /rationalists?\b/i },
  { id: 'empiricism', name: 'Empiricism', re: /empiricists?\b/i },
  { id: 'enlightenment', name: 'Enlightenment', re: /enlightenment/i },
  { id: 'idealism', name: 'Idealism', re: /idealists?\b|hegelian|kantian|neo-?kantian|german idealism/i },
  { id: 'romanticism', name: 'Romanticism', re: /romantic/i },
  { id: 'transcendentalism', name: 'Transcendentalism', re: /transcendentalis/i },
  { id: 'materialism', name: 'Materialism', re: /materialists?\b|dialectical materialis/i },
  { id: 'deism', name: 'Deism & Pantheism', re: /deist|pantheis/i },
  // Modern & contemporary
  { id: 'utilitarianism', name: 'Utilitarianism', re: /utilitarian|consequentialist/i },
  { id: 'pragmatism', name: 'Pragmatism', re: /pragmatis/i },
  { id: 'existentialism', name: 'Existentialism', re: /existentialis/i },
  { id: 'phenomenology', name: 'Phenomenology & Hermeneutics', re: /phenomenolog|hermeneut/i },
  { id: 'analytic', name: 'Analytic philosophy', re: /analytic philosoph|ordinary language|logical positivis|vienna circle|wittgenstein|positivis/i },
  { id: 'continental', name: 'Continental & Critical theory', re: /continental philosoph|frankfurt school|critical theor/i },
  { id: 'poststructuralism', name: 'Structuralism & Postmodernism', re: /structuralis|postmodern/i },
  { id: 'nihilism', name: 'Nihilism & Pessimism', re: /nihilis|pessimis|anti-natalis|absurdis/i },
  { id: 'ethics', name: 'Virtue & natural-law ethics', re: /virtue ethic|natural law|deontolog/i },
  { id: 'humanism', name: 'Humanism', re: /humanis/i },
  { id: 'atheism', name: 'Atheism & Freethought', re: /atheis|freethought|secular/i },
  { id: 'psychoanalysis', name: 'Psychoanalysis', re: /psychoanaly/i },
  { id: 'environmental', name: 'Environmental thought', re: /environmental philosoph|deep ecolog|ecologis/i },
  // Political
  { id: 'marxism', name: 'Marxism & Socialism', re: /marxis|communis|socialis|dialectical/i },
  { id: 'anarchism', name: 'Anarchism', re: /anarchis/i },
  { id: 'liberalism', name: 'Liberalism & Libertarianism', re: /liberalism|libertarian(?! socialis)|classical liberal|classical economists/i },
  { id: 'conservatism', name: 'Conservatism & Realism', re: /conservativ|political realist/i },
  { id: 'feminism', name: 'Feminism', re: /feminis/i },
  { id: 'nationalism', name: 'Nationalism & Anti-colonialism', re: /nationalis|postcolonial|anti-colonial|independence activist/i },
]

// "Critics of Marxism", "Former atheists" etc. say what someone opposed or left, not what they are.
const OPPOSING = /\b(critics?|opponents) of\b|\bformer\b|\bconverts? to\b|\banti-(communis|fascis|stalinis|nationalis|marxis|zionis|capitalis)/i

/** @returns {number[]} indexes into SCHOOLS */
export function classifySchools({ categories = [], movements = [], description = '' }) {
  const sources = [...categories.filter((c) => !OPPOSING.test(c)), ...movements, description.replace(/\(.*?\)/g, '')]
  const out = []
  SCHOOLS.forEach((s, i) => {
    if (sources.some((t) => s.re.test(t))) out.push(i)
  })
  return out
}
