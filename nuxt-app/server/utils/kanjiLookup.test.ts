import { describe, expect, it } from "vitest";
import { extractKanji, kanjiNotice, lookupKanji, lookupKanjiInText, MAX_KANJI_RESULTS, pruneNestedParts } from "./kanjiLookup.ts";

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

describe("pruneNestedParts", () => {
  const table: Record<string, string[]> = { 化: ["化", "匕"], 艾: ["ノ", "艾"], 匕: ["匕"], 田: ["田"], 鬼: ["鬼", "田", "匕"] };
  const partsOf = (part: string) => table[part];

  it("drops a part that another listed part already contains", () => {
    expect(pruneNestedParts("花", ["化", "匕", "艾"], partsOf)).toEqual(["化", "艾"]);
  });

  it("keeps a part nothing else contains, including one with no entry", () => {
    expect(pruneNestedParts("x", ["田", "匕", "ノ"], partsOf)).toEqual(["田", "匕", "ノ"]);
  });

  it("keeps both parts when they contain each other", () => {
    expect(pruneNestedParts("x", ["a", "b"], (part) => (part === "a" ? ["b"] : ["a"]))).toEqual(["a", "b"]);
  });

  it("does not let the kanji's own entry prune its other parts", () => {
    expect(pruneNestedParts("鬼", ["鬼", "田", "匕"], partsOf)).toEqual(["鬼", "田", "匕"]);
  });

  it("leaves a single part and an empty list alone", () => {
    expect(pruneNestedParts("x", ["田"], partsOf)).toEqual(["田"]);
    expect(pruneNestedParts("x", [], partsOf)).toEqual([]);
  });
});

describe("lookupKanji parts from the bundled data", () => {
  it("drops the spoon already inside change for 花", () => {
    expect(lookupKanji(["花"]).kanji[0]!.parts).toEqual(["化", "艾"]);
  });

  it("shows far fewer parts for 魔 and none of those nested in 鬼 or 麻", () => {
    const parts = lookupKanji(["魔"]).kanji[0]!.parts;
    expect(parts).toContain("鬼");
    expect(parts).toContain("麻");
    for (const nested of ["田", "儿", "匕", "厶", "木", "广"]) expect(parts).not.toContain(nested);
  });

  it("keeps the bare shapes of a kanji built from them", () => {
    expect(lookupKanji(["鬼"]).kanji[0]!.parts.length).toBeGreaterThan(1);
  });
});
