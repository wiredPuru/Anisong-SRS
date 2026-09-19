import { describe, expect, it } from "vitest";
import { evaluateSongAnswer, normalizeSongTitle } from "./songAnswer";

const card = { songTitle: "Gurenge", songTitleNative: "紅蓮華" };

describe("normalizeSongTitle", () => {
  it("lowercases and drops every space", () => {
    expect(normalizeSongTitle("  Unravel   The   Song  ")).toBe("unravelthesong");
  });

  it("folds full-width characters typed on a Japanese IME", () => {
    expect(normalizeSongTitle("ＲＥＡＤＹ！！")).toBe("ready!!");
  });
});

describe("evaluateSongAnswer", () => {
  it("accepts an exact and a case-only difference", () => {
    expect(evaluateSongAnswer(card, "Gurenge")).toBe(true);
    expect(evaluateSongAnswer(card, "gUrEnGe")).toBe(true);
  });

  it("accepts the native title of a card stored under a romanized one", () => {
    expect(evaluateSongAnswer(card, "紅蓮華")).toBe(true);
  });

  it("ignores surrounding and doubled whitespace", () => {
    expect(evaluateSongAnswer({ songTitle: "Kaikai Kitan", songTitleNative: "廻廻奇譚" }, "  Kaikai   Kitan ")).toBe(true);
  });

  // Real disagreement between the library and the search provider for card 409.
  it("accepts a different romanized word split of the same title", () => {
    const stored = { songTitle: "Kaze no Tadori Tsuku Basho", songTitleNative: "Kaze no Tadori Tsuku Basho" };
    expect(evaluateSongAnswer(stored, "Kaze no Tadoritsuku Basho")).toBe(true);
  });

  it("rejects a punctuation mismatch rather than grading it loosely", () => {
    expect(evaluateSongAnswer({ songTitle: "READY!!", songTitleNative: "READY!!" }, "READY!")).toBe(false);
  });

  it("rejects a different song and an empty answer", () => {
    expect(evaluateSongAnswer(card, "Homura")).toBe(false);
    expect(evaluateSongAnswer(card, "   ")).toBe(false);
  });
});
