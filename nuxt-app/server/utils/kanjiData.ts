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

export interface KanjiSearchResult {
  char: string;
  keyword: string;
  alternates: string[];
  rtk: number | null;
}

export type KanjiRecord = Omit<KanjiEntry, "char">;

export interface KanjiDataFile {
  notice: string;
  kanji: Record<string, KanjiRecord>;
}

export const KANJI_NOTICE =
  "Kanji data from KANJIDIC2 and KRADFILE, copyright the Electronic Dictionary Research and Development Group, "
  + "used under CC BY-SA 4.0 (https://www.edrdg.org/edrdg/licence.html). Changed: reduced to the fields this app uses.";

const MAX_ALTERNATES = 2;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name]!);
}

function tagValues(block: string, tag: string, attrFilter?: RegExp): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`<${tag}([^>]*)>([^<]*)</${tag}>`, "g");
  for (const match of block.matchAll(pattern)) {
    if (attrFilter && !attrFilter.test(match[1]!)) continue;
    out.push(decodeEntities(match[2]!.trim()));
  }
  return out.filter((value) => value !== "");
}

function firstNumber(block: string, tag: string): number | null {
  const value = tagValues(block, tag)[0];
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// RTK frame numbers are only references into the user's own book; the 6th
// edition number is preferred, the older one a fallback.
function rtkFrame(block: string): number | null {
  const pick = (type: string) => {
    const match = block.match(new RegExp(`<dic_ref dr_type="${type}"[^>]*>(\\d+)</dic_ref>`));
    return match ? Number.parseInt(match[1]!, 10) : null;
  };
  return pick("heisig6") ?? pick("heisig");
}

export function parseKanjidic(xml: string): Map<string, Omit<KanjiRecord, "parts">> {
  const entries = new Map<string, Omit<KanjiRecord, "parts">>();
  for (const match of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const block = match[1]!;
    const char = tagValues(block, "literal")[0];
    if (!char) continue;
    // A plain <meaning> has no m_lang attribute; those are the English ones.
    const meanings = tagValues(block, "meaning", /^\s*$/);
    entries.set(char, {
      keyword: meanings[0] ?? "",
      alternates: meanings.slice(1, 1 + MAX_ALTERNATES),
      on: tagValues(block, "reading", /r_type="ja_on"/),
      kun: tagValues(block, "reading", /r_type="ja_kun"/),
      strokes: firstNumber(block, "stroke_count") ?? 0,
      grade: firstNumber(block, "grade"),
      jlpt: firstNumber(block, "jlpt"),
      freq: firstNumber(block, "freq"),
      rtk: rtkFrame(block),
    });
  }
  return entries;
}

export function parseKradfile(text: string): Map<string, string[]> {
  const parts = new Map<string, string[]>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [char, rest] = line.split(" : ");
    if (!char || rest === undefined) continue;
    const components = rest.trim().split(/\s+/).filter(Boolean);
    if (components.length) parts.set(char, components);
  }
  return parts;
}

// Only kanji KRADFILE decomposes are kept, which is the JIS X 0208 set.
export function buildKanjiData(
  kanjidic: Map<string, Omit<KanjiRecord, "parts">>,
  kradfile: Map<string, string[]>,
): KanjiDataFile {
  const kanji: Record<string, KanjiRecord> = {};
  for (const [char, record] of kanjidic) {
    const parts = kradfile.get(char);
    if (parts) kanji[char] = { ...record, parts };
  }
  return { notice: KANJI_NOTICE, kanji };
}
