import { describe, expect, it } from "vitest";
import { isKanaTarget, shiftKana, toKanaText } from "./furigana.ts";

describe("isKanaTarget", () => {
  it("accepts only the two kana scripts", () => {
    expect(isKanaTarget("hiragana") && isKanaTarget("katakana")).toBe(true);
    expect(isKanaTarget("romaji")).toBe(false);
    expect(isKanaTarget(undefined)).toBe(false);
  });
});

describe("shiftKana", () => {
  it("shifts katakana to hiragana and back, keeping marks and other text", () => {
    expect(shiftKana("カタカナ ー ・ ABC 日本", "hiragana")).toBe("かたかな ー ・ ABC 日本");
    expect(shiftKana("ひらがな ー ABC", "katakana")).toBe("ヒラガナ ー ABC");
  });

  it("leaves text already in the target script alone", () => {
    expect(shiftKana("うた", "hiragana")).toBe("うた");
    expect(shiftKana("ウタ", "katakana")).toBe("ウタ");
  });
});

describe("toKanaText", () => {
  it("turns kanji into hiragana or katakana", async () => {
    expect(await toKanaText("歌", "hiragana")).toBe("うた");
    expect(await toKanaText("歌", "katakana")).toBe("ウタ");
  });

  it("converts the kana already in a title and leaves latin text alone", async () => {
    expect(await toKanaText("ひぐらしのなく頃に", "katakana")).toBe("ヒグラシノナクコロニ");
    expect(await toKanaText("Song カタカナ", "hiragana")).toBe("Song かたかな");
  });
}, 60_000);
