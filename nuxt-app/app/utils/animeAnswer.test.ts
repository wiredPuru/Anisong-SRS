import { describe, expect, it } from "vitest";
import { evaluateAnimeAnswer, findTypedAnimeMatch, shouldIgnoreAnswerKey } from "./animeAnswer";

describe("evaluateAnimeAnswer", () => {
  it("grades the selected identity independently of its display title", () => {
    const variants = [
      { aniListId: 101, label: "English title" },
      { aniListId: 101, label: "Romaji title" },
      { aniListId: 101, label: "日本語のタイトル" },
    ];
    for (const selection of variants) {
      expect(evaluateAnimeAnswer(101, selection.aniListId)).toBe("pass");
    }
  });

  it("fails a different anime identity, including a separate season", () => {
    expect(evaluateAnimeAnswer(101, 102)).toBe("fail");
  });

  it.each([undefined, null, "101", "", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, true, {}])(
    "does not grade an invalid identity: %s",
    (invalid) => {
      expect(evaluateAnimeAnswer(invalid, 101)).toBe("unavailable");
      expect(evaluateAnimeAnswer(101, invalid)).toBe("unavailable");
      expect(evaluateAnimeAnswer(invalid, invalid)).toBe("unavailable");
    },
  );

  it("accepts the positive safe integer boundaries", () => {
    expect(evaluateAnimeAnswer(1, 1)).toBe("pass");
    expect(evaluateAnimeAnswer(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe("pass");
  });
});

describe("typed-answer key guard", () => {
  it.each([
    [true, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [false, false, false, true],
  ])("ignores disabled, IME-composing, and repeated keys", (disabled, eventComposing, composing, repeated) => {
    expect(shouldIgnoreAnswerKey(disabled, eventComposing, composing, repeated)).toBe(true);
  });

  it("handles a normal key after composition ends", () => {
    expect(shouldIgnoreAnswerKey(false, false, false, false)).toBe(false);
  });
});

describe("findTypedAnimeMatch", () => {
  const options = [
    { aniListId: 1, titleRomaji: "Canaan", titleEnglish: "Canaan", titleNative: "CANAAN" },
    { aniListId: 2, titleRomaji: "Seikon no Qwaser", titleEnglish: "The Qwaser of Stigmata", titleNative: "聖痕のクェイサー" },
    { aniListId: 3, titleRomaji: "Seikon no Qwaser II", titleEnglish: null, titleNative: null },
  ];

  it("matches any title, ignoring case, spacing and full-width characters", () => {
    expect(findTypedAnimeMatch("the qwaser of stigmata", options)?.aniListId).toBe(2);
    expect(findTypedAnimeMatch("Seikon noQwaser", options)?.aniListId).toBe(2);
    expect(findTypedAnimeMatch("聖痕のクェイサー", options)?.aniListId).toBe(2);
    expect(findTypedAnimeMatch("ＣＡＮＡＡＮ", options)?.aniListId).toBe(1);
  });

  it("needs the whole title, not a prefix", () => {
    expect(findTypedAnimeMatch("Seikon", options)).toBeNull();
    expect(findTypedAnimeMatch("Seikon no Qwaser II", options)?.aniListId).toBe(3);
  });

  it("takes the first match in ranking order", () => {
    const remakes = [
      { aniListId: 11061, titleRomaji: "HUNTER×HUNTER (2011)", titleEnglish: "Hunter x Hunter", titleNative: null },
      { aniListId: 136, titleRomaji: "HUNTER×HUNTER", titleEnglish: "Hunter x Hunter", titleNative: null },
    ];
    expect(findTypedAnimeMatch("hunter x hunter", remakes)?.aniListId).toBe(11061);
  });

  it("finds nothing for blank text or no options", () => {
    expect(findTypedAnimeMatch("  ", options)).toBeNull();
    expect(findTypedAnimeMatch("Canaan", [])).toBeNull();
  });
});
