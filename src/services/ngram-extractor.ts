// Stop words to skip when building n-grams
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'not',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'our',
  'their',
  'what',
  'which',
  'who',
  'when',
  'where',
  'how',
  'if',
  'as',
  'so',
  'up',
]);

const MIN_TOKEN_LEN = 3;
const MAX_NGRAM_TOKENS = 3;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sऀ-ॿ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN && !STOP_WORDS.has(t));
}

export function extractNgrams(text: string, _language?: string): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const ngrams = new Set<string>();

  for (let n = 1; n <= Math.min(MAX_NGRAM_TOKENS, tokens.length); n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n).join(' ');
      if (phrase.length >= MIN_TOKEN_LEN) ngrams.add(phrase);
    }
  }

  // Cap at 20 most specific n-grams (prefer longer ones)
  return [...ngrams]
    .sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length)
    .slice(0, 20);
}

export function languageForText(lang: string): string {
  if (lang === 'HI' || lang === 'HI-EN') return lang;
  return 'EN';
}
