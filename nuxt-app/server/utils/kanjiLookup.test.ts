import { describe, expect, it } from "vitest";
import { extractKanji, kanjiNotice, lookupKanji, lookupKanjiInText, MAX_KANJI_RESULTS } from "./kanjiLookup.ts";

describe("extractKanji", () => {
  it("keeps only ideographs, once each, in first-seen order", () => {
    expect(extractKanji("歌を歌う Song 日本語 ひらがな カタカナ 日")).toEqual(["歌", "日", "本", "語"]);
  });

  it("ignores kana, latin, digits, punctuation, and the iteration mark", () => {
    expect(extractKanji("ABC 123 ひらがな ー、。 々")).toEqual([]);
  });

  it("returns nothing for an empty string", () => {
    expect(extractKanji("")).toEqual([]);
  });
});

describe("lookupKanji", () => {
  it("returns a full entry from the bundled data", () => {
    const { kanji, unknown } = lookupKanji(["歌"]);
    expect(unknown).toEqual([]);
    expect(kanji[0]).toMatchObject({ char: "歌", keyword: "song", alternates: ["sing"], on: ["カ"], strokes: 14 });
    expect(kanji[0]!.kun).toContain("うた");
    expect(kanji[0]!.parts.length).toBeGreaterThan(1);
  });

  it("reports an ideograph outside the bundled set as unknown", () => {
    const { kanji, unknown } = lookupKanji(["日", "𠮟"]);
    expect(kanji.map((entry) => entry.char)).toEqual(["日"]);
    expect(unknown).toEqual(["𠮟"]);
  });

  it("covers the whole JIS X 0208 set and carries the licence notice", () => {
    expect(lookupKanji(["亜", "腕", "本"]).unknown).toEqual([]);
    expect(kanjiNotice()).toContain("CC BY-SA");
  });
});

describe("lookupKanjiInText", () => {
  it("looks up a real title's kanji", () => {
    expect(lookupKanjiInText("ひぐらしのなく頃に").kanji.map((entry) => entry.char)).toEqual(["頃"]);
  });

  it("caps how many kanji it returns", () => {
    const text = [...lookupKanji(Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0x4e00 + i))).kanji]
      .map((entry) => entry.char).join("");
    expect(text.length).toBeGreaterThan(MAX_KANJI_RESULTS);
    expect(lookupKanjiInText(text).kanji).toHaveLength(MAX_KANJI_RESULTS);
  });
});
