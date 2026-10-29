import kanjiFile from "../data/kanji.json";
import type { KanjiDataFile, KanjiEntry } from "./kanjiData.ts";

export const MAX_KANJI_TEXT = 200;
export const MAX_KANJI_RESULTS = 100;

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
