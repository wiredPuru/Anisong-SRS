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

export function lookupKanji(chars: readonly string[]): { kanji: KanjiEntry[]; unknown: string[] } {
  const kanji: KanjiEntry[] = [];
  const unknown: string[] = [];
  for (const char of chars) {
    const record = data.kanji[char];
    if (record) kanji.push({ char, ...record });
    else unknown.push(char);
  }
  return { kanji, unknown };
}

export function lookupKanjiInText(text: string): { kanji: KanjiEntry[]; unknown: string[] } {
  return lookupKanji(extractKanji(text).slice(0, MAX_KANJI_RESULTS));
}
