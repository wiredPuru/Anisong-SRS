import { describe, expect, it } from "vitest";
import { canAddToKanjiDeck, kanjiDeckAfter } from "./kanjiDeck.ts";

describe("canAddToKanjiDeck", () => {
  it("needs a dictionary entry", () => {
    expect(canAddToKanjiDeck(null)).toBe(false);
    expect(canAddToKanjiDeck(undefined)).toBe(false);
    expect(
      canAddToKanjiDeck({ char: "魔", keyword: "witch", alternates: [], parts: [], on: [], kun: [], strokes: 21, grade: null, jlpt: null, freq: null, rtk: 2178 }),
    ).toBe(true);
  });
});

describe("kanjiDeckAfter", () => {
  it("adds and removes without mutating the original", () => {
    const deck = new Set(["魔"]);
    const added = kanjiDeckAfter(deck, "鬼", true);
    expect([...added].sort()).toEqual(["魔", "鬼"].sort());
    expect([...deck]).toEqual(["魔"]);
    expect([...kanjiDeckAfter(added, "魔", false)]).toEqual(["鬼"]);
  });

  it("is idempotent", () => {
    expect([...kanjiDeckAfter(new Set(["魔"]), "魔", true)]).toEqual(["魔"]);
    expect([...kanjiDeckAfter(new Set(), "魔", false)]).toEqual([]);
  });
});
