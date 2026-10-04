// Keyword-based topic classifier. Each category lists word stems; a quote is
// tagged with its best-scoring categories (up to three).
export const CATEGORIES = [
  { id: 'ethics', name: 'Ethics & Morality', words: ['moral', 'ethic', 'virtue', 'vice', 'good', 'evil', 'duty', 'conscience', 'right and wrong', 'honest', 'honour', 'honor', 'vain', 'sin', 'goodness', 'cruel', 'kind', 'noble', 'selfish', 'obligation'] },
  { id: 'metaphysics', name: 'Metaphysics & Existence', words: ['being', 'exist', 'reality', 'real', 'substance', 'essence', 'universe', 'cosmos', 'nothing', 'absolute', 'infinite', 'matter', 'nature of', 'world', 'ontolog', 'metaphysic', 'abstract'] },
  { id: 'knowledge', name: 'Knowledge & Truth', words: ['truth', 'knowledge', 'know', 'belief', 'believe', 'doubt', 'certain', 'reason', 'evidence', 'perception', 'experience', 'opinion', 'error', 'false', 'skeptic', 'sceptic', 'understand'] },
  { id: 'mind', name: 'Mind & Consciousness', words: ['mind', 'conscious', 'thought', 'thinking', 'soul', 'brain', 'idea', 'imagination', 'memory', 'dream', 'intellect', 'mental', 'psycholog', 'self', 'perceive', 'sensation'] },
  { id: 'politics', name: 'Politics & Society', words: ['state', 'government', 'society', 'political', 'law', 'citizen', 'democra', 'tyran', 'revolution', 'nation', 'people', 'king', 'liberty', 'republic', 'class', 'war', 'peace', 'rule', 'capital', 'economy', 'social', 'authority', 'censor'] },
  { id: 'freedom', name: 'Freedom & Will', words: ['freedom', 'free will', 'free', 'will', 'choice', 'choose', 'determin', 'fate', 'destiny', 'liberty', 'independen', 'responsib', 'autonomy', 'slave'] },
  { id: 'religion', name: 'Religion & God', words: ['god', 'religio', 'faith', 'divine', 'heaven', 'church', 'christian', 'prayer', 'holy', 'sacred', 'creator', 'atheis', 'theolog', 'spirit', 'worship', 'bible', 'immortal'] },
  { id: 'death', name: 'Death & Mortality', words: ['death', 'die', 'dying', 'dead', 'mortal', 'grave', 'funeral', 'suffering', 'pain', 'fear', 'afterlife', 'suicide', 'perish'] },
  { id: 'love', name: 'Love & Friendship', words: ['love', 'friend', 'marriage', 'woman', 'women', 'passion', 'desire', 'heart', 'beloved', 'affection', 'family', 'father', 'mother', 'child', 'husband', 'wife', 'sex'] },
  { id: 'happiness', name: 'Happiness & Good Life', words: ['happy', 'happiness', 'pleasure', 'joy', 'good life', 'content', 'peace of', 'enjoy', 'wellbeing', 'fortune', 'tranquil', 'well-being', 'flourish', 'misery', 'life', 'live'] },
  { id: 'wisdom', name: 'Wisdom & Learning', words: ['wise', 'wisdom', 'learn', 'educat', 'teach', 'study', 'book', 'philosoph', 'fool', 'folly', 'student', 'scholar', 'genius', 'ignoran', 'teacher', 'school'] },
  { id: 'time', name: 'Time & Change', words: ['time', 'change', 'past', 'future', 'present', 'history', 'age', 'eternal', 'moment', 'become', 'becoming', 'progress', 'tomorrow', 'yesterday', 'year', 'old'] },
  { id: 'science', name: 'Science & Nature', words: ['science', 'scientific', 'nature', 'natural', 'physic', 'mathematic', 'experiment', 'theory', 'universe', 'evolution', 'biolog', 'animal', 'law of nature', 'technology', 'machine', 'hypothes', 'discover'] },
  { id: 'art', name: 'Art & Beauty', words: ['art', 'beauty', 'beautiful', 'poet', 'music', 'aesthetic', 'painting', 'literature', 'creative', 'artist', 'sublime', 'taste', 'imagination', 'novel', 'tragedy'] },
  { id: 'language', name: 'Language & Logic', words: ['language', 'word', 'logic', 'meaning', 'sentence', 'proposition', 'argument', 'speak', 'speech', 'sign', 'concept', 'definition', 'statement', 'grammar', 'rhetoric', 'paradox'] },
  { id: 'power', name: 'Power & Justice', words: ['power', 'justice', 'just', 'unjust', 'right', 'rights', 'equal', 'wealth', 'poor', 'rich', 'property', 'strong', 'weak', 'oppress', 'crime', 'punish', 'tyrant'] },
  { id: 'action', name: 'Action & Character', words: ['action', 'act', 'courage', 'brave', 'habit', 'character', 'discipline', 'effort', 'work', 'labour', 'labor', 'success', 'ambition', 'anger', 'patience', 'self-control', 'resolve', 'duty'] },
]

const compiled = CATEGORIES.map((c) => ({
  ...c,
  re: new RegExp(`\\b(?:${c.words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'),
}))

// Words that are too generic to decide a category alone; they only count half.
const WEAK = new Set(['life', 'live', 'world', 'good', 'will', 'time', 'old', 'age', 'free', 'real', 'work', 'act', 'right', 'just', 'state', 'people', 'being', 'know', 'self', 'word', 'sign'])

export function classify(text) {
  const scores = []
  for (const [i, c] of compiled.entries()) {
    let score = 0
    for (const m of text.matchAll(c.re)) score += WEAK.has(m[0].toLowerCase()) ? 0.5 : 1
    if (score >= 1) scores.push([i, score])
  }
  if (!scores.length) return []
  scores.sort((a, b) => b[1] - a[1])
  const top = scores.filter(([, s]) => s >= scores[0][1] * 0.6).slice(0, 3)
  return top.map(([i]) => i)
}
