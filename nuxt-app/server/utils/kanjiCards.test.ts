import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { kanjiCard } from "../db/schema.ts";
import {
  addKanjiCards,
  getNextKanji,
  listKanjiCards,
  parseKanjiAddBody,
  parseKanjiCharsBody,
  parseKanjiReviewBody,
  removeKanjiCards,
  reviewKanji,
} from "./kanjiCards.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

beforeEach(() => {
  db.delete(kanjiCard).run();
});

describe("parseKanjiCharsBody", () => {
  it("rejects empty, non-array and oversized lists", () => {
    expect(parseKanjiCharsBody({ chars: [] })).toHaveProperty("error");
    expect(parseKanjiCharsBody({})).toHaveProperty("error");
    expect(parseKanjiCharsBody(null)).toHaveProperty("error");
    expect(parseKanjiCharsBody({ chars: Array(101).fill("魔") })).toHaveProperty("error");
  });

  it("rejects multi-character strings, kana and non-strings", () => {
    expect(parseKanjiCharsBody({ chars: ["魔鬼"] })).toHaveProperty("error");
    expect(parseKanjiCharsBody({ chars: ["あ"] })).toHaveProperty("error");
    expect(parseKanjiCharsBody({ chars: [5] })).toHaveProperty("error");
  });

  it("dedupes", () => {
    expect(parseKanjiCharsBody({ chars: ["魔", "鬼", "魔"] })).toEqual({ chars: ["魔", "鬼"] });
  });
});

describe("parseKanjiAddBody", () => {
  it("names a character with no dictionary entry", () => {
    // 𠀀 (U+20000) is an ideograph the bundled dictionary does not hold.
    const result = parseKanjiAddBody({ chars: ["魔", "\u{20000}"] });
    expect(result).toEqual({ error: "\u{20000} has no kanji dictionary entry" });
  });

  it("accepts known kanji", () => {
    expect(parseKanjiAddBody({ chars: ["魔"] })).toEqual({ chars: ["魔"] });
  });
});

describe("parseKanjiReviewBody", () => {
  it("needs a single kanji and a pass or fail", () => {
    expect(parseKanjiReviewBody({ char: "魔", result: "pass" })).toEqual({ char: "魔", result: "pass" });
    expect(parseKanjiReviewBody({ char: "魔", result: "meh" })).toHaveProperty("error");
    expect(parseKanjiReviewBody({ char: "ab", result: "pass" })).toHaveProperty("error");
    expect(parseKanjiReviewBody(null)).toHaveProperty("error");
  });
});

describe("kanji deck", () => {
  it("adds idempotently at box 1, due now", () => {
    expect(addKanjiCards(["魔", "鬼"])).toEqual({ added: 2, alreadyAdded: 0 });
    expect(addKanjiCards(["魔"])).toEqual({ added: 0, alreadyAdded: 1 });
    const { cards, dueCount, total } = listKanjiCards();
    expect(total).toBe(2);
    expect(dueCount).toBe(2);
    expect(cards.every((item) => item.box === 1 && item.entry.char === item.char)).toBe(true);
  });

  it("removes", () => {
    addKanjiCards(["魔", "鬼"]);
    expect(removeKanjiCards(["魔", "山"])).toEqual({ removed: 1 });
    expect(listKanjiCards().total).toBe(1);
  });

  it("serves the oldest due kanji and skips future ones", () => {
    addKanjiCards(["魔", "鬼", "山"]);
    const now = Date.now();
    db.update(kanjiCard).set({ nextReviewAt: new Date(now - 2000) }).where(eqChar("鬼")).run();
    db.update(kanjiCard).set({ nextReviewAt: new Date(now - 9000) }).where(eqChar("山")).run();
    db.update(kanjiCard).set({ nextReviewAt: new Date(now + 86_400_000) }).where(eqChar("魔")).run();
    const next = getNextKanji();
    expect(next.kanji?.char).toBe("山");
    expect(next.dueCount).toBe(2);
  });

  it("returns null when nothing is due", () => {
    expect(getNextKanji()).toEqual({ kanji: null, dueCount: 0 });
  });

  it("graduates from box 1 only after the required streak, and a fail resets", () => {
    addKanjiCards(["魔"]);
    const first = reviewKanji("魔", "pass");
    if ("notFound" in first) throw new Error("expected a review");
    expect(first.kanji.box).toBe(1);
    expect(first.kanji.streak).toBe(1);
    for (let i = 0; i < 5; i += 1) reviewKanji("魔", "pass");
    const graduated = listKanjiCards().cards[0]!;
    expect(graduated.box).toBeGreaterThan(1);
    expect(graduated.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
    const failed = reviewKanji("魔", "fail");
    if ("notFound" in failed) throw new Error("expected a review");
    expect(failed.kanji.box).toBe(1);
    expect(failed.kanji.streak).toBe(0);
  });

  it("reports an unknown kanji as not found", () => {
    expect(reviewKanji("魔", "pass")).toEqual({ notFound: true });
  });
});

function eqChar(char: string) {
  return eq(kanjiCard.char, char);
}
