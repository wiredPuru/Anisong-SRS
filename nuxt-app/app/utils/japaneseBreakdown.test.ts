import { describe, expect, it } from "vitest";
import { formatKunReading, formatRtkFrame, formatStrokes, hasKanji, parseScript, titleSections } from "./japaneseBreakdown.ts";

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
