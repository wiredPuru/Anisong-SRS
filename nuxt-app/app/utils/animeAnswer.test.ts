import { describe, expect, it } from "vitest";
import { evaluateAnimeAnswer, shouldIgnoreAnswerKey } from "./animeAnswer";

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
