import { describe, expect, it } from "vitest";
import { backKanji, formatKunReading, formatRtkFrame, formatStrokes, hasKanji, openKanji, parseScript, storyDraftState, titleSections, MAX_KANJI_STORY_LENGTH } from "./japaneseBreakdown.ts";

describe("parseScript", () => {
  it("accepts the three scripts and falls back to normal", () => {
    expect(parseScript("hiragana")).toBe("hiragana");
    expect(parseScript("katakana")).toBe("katakana");
    expect(parseScript("normal")).toBe("normal");
    expect(parseScript("romaji")).toBe("normal");
    expect(parseScript(null)).toBe("normal");
  });
});

describe("hasKanji", () => {
  it("is true only for ideographs", () => {
    expect(hasKanji("ひぐらしのなく頃に")).toBe(true);
    expect(hasKanji("ひらがな カタカナ ABC")).toBe(false);
    expect(hasKanji("々")).toBe(false);
  });
});

describe("titleSections", () => {
  it("lists the anime then the song, trimmed", () => {
    expect(titleSections(" ひぐらし ", "歌")).toEqual([
      { key: "anime", label: "Anime", text: "ひぐらし" },
      { key: "song", label: "Song", text: "歌" },
    ]);
  });

  it("drops a blank title", () => {
    expect(titleSections("", "歌")).toEqual([{ key: "song", label: "Song", text: "歌" }]);
    expect(titleSections("  ", "")).toEqual([]);
  });
});

describe("reading and meta formatting", () => {
  it("shows okurigana in brackets and leaves plain and affix readings alone", () => {
    expect(formatKunReading("うた.う")).toBe("うた(う)");
    expect(formatKunReading("ひ")).toBe("ひ");
    expect(formatKunReading("-び")).toBe("-び");
  });

  it("pluralizes strokes and formats the RTK frame", () => {
    expect(formatStrokes(1)).toBe("1 stroke");
    expect(formatStrokes(14)).toBe("14 strokes");
    expect(formatRtkFrame(508)).toBe("RTK #508");
    expect(formatRtkFrame(null)).toBeNull();
  });
});

describe("kanji drill stack", () => {
  it("pushes each opened character", () => {
    expect(openKanji(openKanji([], "魔"), "鬼")).toEqual(["魔", "鬼"]);
  });

  it("ignores reopening the character already on top", () => {
    expect(openKanji(["魔"], "魔")).toEqual(["魔"]);
  });

  it("goes back one level and stops at empty", () => {
    expect(backKanji(["魔", "鬼"])).toEqual(["魔"]);
    expect(backKanji(["魔"])).toEqual([]);
    expect(backKanji([])).toEqual([]);
  });

  it("does not mutate the stack it was given", () => {
    const stack = ["魔"];
    openKanji(stack, "鬼");
    backKanji(stack);
    expect(stack).toEqual(["魔"]);
  });
});

describe("storyDraftState", () => {
  it("is not dirty when the draft matches the saved story, ignoring outer whitespace", () => {
    expect(storyDraftState("a demon", "  a demon ")).toEqual({ dirty: false, tooLong: false, canSave: false });
    expect(storyDraftState(null, "")).toEqual({ dirty: false, tooLong: false, canSave: false });
  });

  it("can save a new or changed non-empty draft", () => {
    expect(storyDraftState(null, "a demon").canSave).toBe(true);
    expect(storyDraftState("a demon", "a big demon").canSave).toBe(true);
  });

  it("cannot save a cleared draft, since Remove is the way to clear", () => {
    expect(storyDraftState("a demon", "   ")).toEqual({ dirty: true, tooLong: false, canSave: false });
  });

  it("cannot save a draft over the limit", () => {
    expect(storyDraftState(null, "x".repeat(MAX_KANJI_STORY_LENGTH + 1)).canSave).toBe(false);
    expect(storyDraftState(null, "x".repeat(MAX_KANJI_STORY_LENGTH)).canSave).toBe(true);
  });
});
