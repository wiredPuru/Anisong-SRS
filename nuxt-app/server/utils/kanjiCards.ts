import { asc, count, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card, kanjiCard } from "../db/schema.ts";
import type { KanjiEntry } from "./kanjiData.ts";
import { extractKanji, lookupKanji } from "./kanjiLookup.ts";
import { getCardWithDetails, type CardWithDetails } from "./cards.ts";
import { getBoxOneStreakRequired } from "./mediaLibrary.ts";
import { computeNextBoxState } from "./study.ts";

export const MAX_KANJI_CARDS_PER_REQUEST = 100;

export interface KanjiStudyItem {
  char: string;
  box: number;
  streak: number;
  nextReviewAt: Date;
  createdAt: Date;
  sourceCardId: number | null;
  entry: KanjiEntry;
  partInfo: { char: string; keyword: string | null }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseKanjiCharsBody(body: unknown): { error: string } | { chars: string[] } {
  const raw = isRecord(body) ? body.chars : undefined;
  if (!Array.isArray(raw) || raw.length === 0) return { error: "chars must be a non-empty array" };
  if (raw.length > MAX_KANJI_CARDS_PER_REQUEST) {
    return { error: `chars must have at most ${MAX_KANJI_CARDS_PER_REQUEST} entries` };
  }
  const chars: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || [...item].length !== 1 || extractKanji(item).length !== 1) {
      return { error: "each char must be a single kanji" };
    }
    if (!chars.includes(item)) chars.push(item);
  }
  return { chars };
}

export function parseKanjiAddBody(
  body: unknown,
): { error: string } | { chars: string[]; sourceCardId?: number } {
  const parsed = parseKanjiCharsBody(body);
  if ("error" in parsed) return parsed;
  const { unknown } = lookupKanji(parsed.chars);
  if (unknown.length > 0) return { error: `${unknown[0]} has no kanji dictionary entry` };
  const source = isRecord(body) ? body.sourceCardId : undefined;
  if (source === undefined) return parsed;
  if (typeof source !== "number" || !Number.isInteger(source) || source < 1) {
    return { error: "sourceCardId must be a positive integer" };
  }
  return { ...parsed, sourceCardId: source };
}

export function parseKanjiReviewBody(body: unknown): { error: string } | { char: string; result: "pass" | "fail" } {
  const parsed = parseKanjiCharsBody(isRecord(body) ? { chars: [body.char] } : null);
  if ("error" in parsed) return { error: "char must be a single kanji" };
  const result = (body as Record<string, unknown>).result;
  if (result !== "pass" && result !== "fail") return { error: "result must be pass or fail" };
  return { char: parsed.chars[0]!, result };
}

type KanjiCardRow = typeof kanjiCard.$inferSelect;

function withEntry(row: KanjiCardRow): KanjiStudyItem | null {
  const entry = lookupKanji([row.char]).kanji[0];
  if (!entry) return null;
  const known = new Map(lookupKanji(entry.parts).kanji.map((part) => [part.char, part.keyword]));
  const partInfo = entry.parts.map((char) => ({ char, keyword: known.get(char) || null }));
  return { ...row, entry, partInfo };
}

export function countDueKanji(now: Date = new Date()): number {
  return db.select({ value: count() }).from(kanjiCard).where(lte(kanjiCard.nextReviewAt, now)).get()?.value ?? 0;
}

export function addKanjiCards(chars: string[], sourceCardId?: number): { added: number; alreadyAdded: number } {
  const existing = db.select({ char: kanjiCard.char }).from(kanjiCard).where(inArray(kanjiCard.char, chars)).all();
  const fresh = chars.filter((char) => !existing.some((row) => row.char === char));
  if (fresh.length > 0) {
    // A card deleted since the page loaded must not fail the add.
    const known = sourceCardId !== undefined && db.select({ id: card.id }).from(card).where(eq(card.id, sourceCardId)).get();
    const source = known ? sourceCardId : null;
    db.insert(kanjiCard).values(fresh.map((char) => ({ char, sourceCardId: source }))).run();
  }
  return { added: fresh.length, alreadyAdded: chars.length - fresh.length };
}

export function removeKanjiCards(chars: string[]): { removed: number } {
  const rows = db.delete(kanjiCard).where(inArray(kanjiCard.char, chars)).returning({ char: kanjiCard.char }).all();
  return { removed: rows.length };
}

export function listKanjiCards(now: Date = new Date()): { cards: KanjiStudyItem[]; dueCount: number; total: number } {
  const cards = db
    .select()
    .from(kanjiCard)
    .orderBy(asc(kanjiCard.nextReviewAt), asc(kanjiCard.createdAt))
    .all()
    .map(withEntry)
    .filter((item): item is KanjiStudyItem => item !== null);
  return { cards, dueCount: countDueKanji(now), total: cards.length };
}

export function getNextKanji(now: Date = new Date()): {
  kanji: KanjiStudyItem | null;
  dueCount: number;
  sourceCard: CardWithDetails | null;
} {
  const row = db
    .select()
    .from(kanjiCard)
    .where(lte(kanjiCard.nextReviewAt, now))
    .orderBy(asc(kanjiCard.nextReviewAt), asc(kanjiCard.createdAt))
    .get();
  const kanji = row ? withEntry(row) : null;
  const sourceCard = kanji?.sourceCardId ? (getCardWithDetails(kanji.sourceCardId) ?? null) : null;
  return { kanji, dueCount: countDueKanji(now), sourceCard };
}

export function reviewKanji(
  char: string,
  result: "pass" | "fail",
): { notFound: true } | { kanji: KanjiStudyItem; dueCount: number } {
  const existing = db.select().from(kanjiCard).where(eq(kanjiCard.char, char)).get();
  const item = existing ? withEntry(existing) : null;
  if (!existing || !item) return { notFound: true };
  const next = computeNextBoxState(existing.box, existing.streak, result, getBoxOneStreakRequired());
  db.update(kanjiCard).set(next).where(eq(kanjiCard.char, char)).run();
  return { kanji: { ...item, ...next }, dueCount: countDueKanji() };
}
