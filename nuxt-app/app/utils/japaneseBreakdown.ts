export const JAPANESE_SCRIPTS = ["normal", "hiragana", "katakana"] as const;
export type JapaneseScript = (typeof JAPANESE_SCRIPTS)[number];

export const JAPANESE_SCRIPT_LABELS: Record<JapaneseScript, string> = {
  normal: "Normal",
  hiragana: "All hiragana",
  katakana: "All katakana",
};

export const JAPANESE_SCRIPT_STORAGE_KEY = "gaqSrs:japaneseScript";

export function parseScript(value: unknown): JapaneseScript {
  return JAPANESE_SCRIPTS.find((script) => script === value) ?? "normal";
}

// Mirrors the 109a route's own ideograph test, so the panel and the server
// agree on what counts as a kanji.
const KANJI = /[㐀-䶿一-鿿\u{20000}-\u{2FFFF}]/u;

export function hasKanji(text: string): boolean {
  return KANJI.test(text);
}

// Mirrors KanjiEntry in server/utils/kanjiData.ts; keep the fields in the same order.
export interface KanjiEntry {
  char: string;
  keyword: string;
  alternates: string[];
  parts: string[];
  on: string[];
  kun: string[];
  strokes: number;
  grade: number | null;
  jlpt: number | null;
  freq: number | null;
  rtk: number | null;
}

export interface TitleSection {
  key: "anime" | "song";
  label: string;
  text: string;
}

// The anime title first, then the song's. A blank title has nothing to break down.
export function titleSections(animeTitleNative: string, songTitleNative: string): TitleSection[] {
  const sections: TitleSection[] = [
    { key: "anime", label: "Anime", text: animeTitleNative.trim() },
    { key: "song", label: "Song", text: songTitleNative.trim() },
  ];
  return sections.filter((section) => section.text !== "");
}

// KANJIDIC2 writes okurigana after a dot and affix readings with a hyphen:
// "か.る" reads かる with る as the okurigana. Shown as か(る).
export function formatKunReading(reading: string): string {
  const dot = reading.indexOf(".");
  if (dot === -1) return reading;
  return `${reading.slice(0, dot)}(${reading.slice(dot + 1)})`;
}

export function formatStrokes(strokes: number): string {
  return `${strokes} ${strokes === 1 ? "stroke" : "strokes"}`;
}

// RTK learners number their frames; the frame is a pointer into their own book.
export function formatRtkFrame(rtk: number | null): string | null {
  return rtk === null ? null : `RTK #${rtk}`;
}

// The characters drilled through, oldest first; the last is the one on screen.
export function openKanji(stack: readonly string[], char: string): string[] {
  return stack[stack.length - 1] === char ? [...stack] : [...stack, char];
}

export function backKanji(stack: readonly string[]): string[] {
  return stack.slice(0, -1);
}
