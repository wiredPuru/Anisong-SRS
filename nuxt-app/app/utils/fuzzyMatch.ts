export interface FuzzyMatchable {
  title: string;
  keywords?: readonly string[];
}

export interface RankedMatch<T> {
  item: T;
  score: number;
}

const TITLE_PREFIX = 1000;
const KEYWORD_PREFIX = 900;
const WORD_TIERS = { prefix: 4, substring: 3, subsequence: 2, typo: 1 } as const;
// A title word outranks a keyword word of the same tier, so "Blur" beats a
// command that only lists "blur" among its keywords.
const TITLE_WORD_BONUS = 2;
// Shorter words have too many neighbours at distance 1 to forgive a typo.
const MIN_TYPO_LENGTH = 4;

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function words(text: string): string[] {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let at = 0;
  for (const char of haystack) {
    if (char === needle[at]) at++;
    if (at === needle.length) return true;
  }
  return false;
}

/** Optimal string alignment distance, capped: returns limit + 1 once exceeded. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2]! + 1);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length]!;
}

/** A typo in a partly typed word: compare against the word's prefixes near the query's length. */
function isTypo(query: string, word: string): boolean {
  if (query.length < MIN_TYPO_LENGTH) return false;
  for (let length = query.length - 1; length <= query.length + 1; length++) {
    if (length > word.length) break;
    if (editDistance(query, word.slice(0, length), 1) <= 1) return true;
  }
  return false;
}

function wordTier(query: string, word: string): number {
  if (word.startsWith(query)) return WORD_TIERS.prefix;
  if (word.includes(query)) return WORD_TIERS.substring;
  if (query.length > 1 && isSubsequence(query, word)) return WORD_TIERS.subsequence;
  if (isTypo(query, word)) return WORD_TIERS.typo;
  return 0;
}

function bestWordScore(query: string, titleWords: string[], keywordWords: string[]): number {
  let best = 0;
  for (const word of titleWords) {
    const tier = wordTier(query, word);
    if (tier) best = Math.max(best, tier * 10 + TITLE_WORD_BONUS);
  }
  for (const word of keywordWords) {
    const tier = wordTier(query, word);
    if (tier) best = Math.max(best, tier * 10);
  }
  return best;
}

/**
 * How well a typed query matches a title and its keywords, or null when it does
 * not. Every query word must match some word; higher scores rank first.
 */
export function fuzzyScore(query: string, title: string, keywords: readonly string[] = []): number | null {
  const queryWords = words(query);
  if (!queryWords.length) return null;
  const phrase = queryWords.join(" ");
  const titleWords = words(title);
  if (titleWords.join(" ").startsWith(phrase)) return TITLE_PREFIX;
  if (keywords.some((keyword) => words(keyword).join(" ").startsWith(phrase))) return KEYWORD_PREFIX;

  const keywordWords = keywords.flatMap(words);
  let total = 0;
  for (const queryWord of queryWords) {
    const score = bestWordScore(queryWord, titleWords, keywordWords);
    if (!score) return null;
    total += score;
  }
  return total;
}

/** Matching items, best first, ties kept in their given order. Empty query: no results. */
export function rankCommands<T extends FuzzyMatchable>(query: string, items: readonly T[], limit: number): RankedMatch<T>[] {
  const ranked: (RankedMatch<T> & { index: number })[] = [];
  items.forEach((item, index) => {
    const score = fuzzyScore(query, item.title, item.keywords);
    if (score !== null) ranked.push({ item, score, index });
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, limit).map(({ item, score }) => ({ item, score }));
}
