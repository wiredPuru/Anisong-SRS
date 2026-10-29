import kanjiFile from "../data/kanji.json";
import type { KanjiDataFile, KanjiEntry, KanjiSearchResult } from "./kanjiData.ts";

export const MAX_KANJI_TEXT = 200;
export const MAX_KANJI_RESULTS = 100;
export const MAX_SEARCH_RESULTS = 20;
export const MIN_KEYWORD_QUERY = 2;

const data = kanjiFile as KanjiDataFile;
// Ideograph blocks only: \p{Script=Han} also matches the marks 々 and 〆.
const HAN = /[\u3400-\u4DBF\u4E00-\u9FFF\u{20000}-\u{2FFFF}]/u;

export function kanjiNotice(): string {
  return data.notice;
}

// Unique ideographs in first-seen order. 々 and 〆 are marks, not kanji entries.
export function extractKanji(text: string): string[] {
  const seen = new Set<string>();
  for (const char of text) {
    if (HAN.test(char)) seen.add(char);
  }
  return [...seen];
}

// KRADFILE lists every shape in a kanji, so a part already inside another listed
// part shows twice (spoon under change). The kanji itself never prunes its own
// parts, or a kanji built from bare shapes would lose all of them.
export function pruneNestedParts(
  char: string,
  parts: readonly string[],
  partsOf: (part: string) => readonly string[] | undefined,
): string[] {
  const contains = (outer: string, inner: string) => outer !== inner && Boolean(partsOf(outer)?.includes(inner));
  return parts.filter(
    (part) => !parts.some((other) => other !== char && contains(other, part) && !contains(part, other)),
  );
}

export function lookupKanji(chars: readonly string[]): { kanji: KanjiEntry[]; unknown: string[] } {
  const kanji: KanjiEntry[] = [];
  const unknown: string[] = [];
  for (const char of chars) {
    const record = data.kanji[char];
    if (record) {
      const parts = pruneNestedParts(char, record.parts, (part) => data.kanji[part]?.parts);
      kanji.push({ char, ...record, parts });
    }
    else unknown.push(char);
  }
  return { kanji, unknown };
}

export function lookupKanjiInText(text: string): { kanji: KanjiEntry[]; unknown: string[] } {
  return lookupKanji(extractKanji(text).slice(0, MAX_KANJI_RESULTS));
}

interface SearchItem extends KanjiSearchResult {
  keywordLower: string;
  alternatesLower: string[];
}

let searchItems: SearchItem[] | null = null;

function getSearchItems(): SearchItem[] {
  searchItems ??= Object.entries(data.kanji).map(([char, record]) => ({
    char,
    keyword: record.keyword,
    alternates: record.alternates,
    rtk: record.rtk,
    keywordLower: record.keyword.toLowerCase(),
    alternatesLower: record.alternates.map((alternate) => alternate.toLowerCase()),
  }));
  return searchItems;
}

const startsWithWord = (text: string, query: string) => text.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(query));

// Lower is better; null means no match.
function matchTier(item: SearchItem, query: string): number | null {
  if (item.keywordLower === query) return 0;
  if (item.keywordLower.startsWith(query)) return 1;
  if (item.alternatesLower.includes(query)) return 2;
  if (item.alternatesLower.some((alternate) => alternate.startsWith(query))) return 3;
  if (startsWithWord(item.keywordLower, query) || item.alternatesLower.some((alternate) => startsWithWord(alternate, query))) return 4;
  return null;
}

const toResult = ({ char, keyword, alternates, rtk }: SearchItem): KanjiSearchResult => ({ char, keyword, alternates, rtk });

export function searchKanji(input: string): KanjiSearchResult[] {
  const query = input.trim().toLowerCase();
  const items = getSearchItems();
  const chars = extractKanji(query);
  if (chars.length) {
    const byChar = new Map(items.map((item) => [item.char, item]));
    return chars.flatMap((char) => byChar.get(char) ?? []).slice(0, MAX_SEARCH_RESULTS).map(toResult);
  }
  if (query.length < MIN_KEYWORD_QUERY) return [];
  const matches: { item: SearchItem; tier: number }[] = [];
  for (const item of items) {
    const tier = matchTier(item, query);
    if (tier !== null) matches.push({ item, tier });
  }
  matches.sort(
    (a, b) =>
      a.tier - b.tier
      || (a.item.rtk ?? Infinity) - (b.item.rtk ?? Infinity)
      || (a.item.char < b.item.char ? -1 : 1),
  );
  return matches.slice(0, MAX_SEARCH_RESULTS).map(({ item }) => toResult(item));
}
