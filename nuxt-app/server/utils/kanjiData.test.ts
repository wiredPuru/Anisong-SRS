import { describe, expect, it } from "vitest";
import { buildKanjiData, KANJI_NOTICE, parseKanjidic, parseKradfile } from "./kanjiData.ts";

const XML = `<?xml version="1.0"?>
<kanjidic2>
<character>
<literal>日</literal>
<misc><grade>1</grade><stroke_count>4</stroke_count><stroke_count>5</stroke_count><freq>1</freq><jlpt>4</jlpt></misc>
<dic_number><dic_ref dr_type="heisig">12</dic_ref><dic_ref dr_type="heisig6">13</dic_ref></dic_number>
<reading_meaning><rmgroup>
<reading r_type="pinyin">ri4</reading>
<reading r_type="ja_on">ニチ</reading>
<reading r_type="ja_on">ジツ</reading>
<reading r_type="ja_kun">ひ</reading>
<reading r_type="ja_kun">-び</reading>
<meaning>day</meaning><meaning>sun</meaning><meaning>Japan</meaning><meaning>counter for days</meaning>
<meaning m_lang="fr">jour</meaning>
</rmgroup></reading_meaning>
</character>
<character>
<literal>鬱</literal>
<misc><stroke_count>29</stroke_count></misc>
<reading_meaning><rmgroup>
<reading r_type="ja_on">ウツ</reading>
<meaning m_lang="fr">dépression</meaning>
</rmgroup></reading_meaning>
</character>
<character>
<literal>&</literal>
<misc><stroke_count>1</stroke_count></misc>
<reading_meaning><rmgroup><meaning>R&amp;D &lt;tag&gt;</meaning></rmgroup></reading_meaning>
</character>
</kanjidic2>`;

describe("parseKanjidic", () => {
  const parsed = parseKanjidic(XML);

  it("reads keyword, up to two alternates, readings, and the first stroke count", () => {
    expect(parsed.get("日")).toEqual({
      keyword: "day",
      alternates: ["sun", "Japan"],
      on: ["ニチ", "ジツ"],
      kun: ["ひ", "-び"],
      strokes: 4,
      grade: 1,
      jlpt: 4,
      freq: 1,
      rtk: 13,
    });
  });

  it("ignores meanings in other languages, leaving an empty keyword", () => {
    expect(parsed.get("鬱")).toMatchObject({ keyword: "", alternates: [], on: ["ウツ"], kun: [], grade: null, jlpt: null, freq: null, rtk: null });
  });

  it("decodes XML entities in meanings", () => {
    expect(parsed.get("&")!.keyword).toBe("R&D <tag>");
  });
});

describe("parseKradfile", () => {
  it("reads components in order and skips comments and blank lines", () => {
    const parts = parseKradfile("# Copyright\n\n亜 : ｜ 一 口\n娃 : 女 土\nbroken line\n");
    expect(parts.get("亜")).toEqual(["｜", "一", "口"]);
    expect(parts.get("娃")).toEqual(["女", "土"]);
    expect(parts.size).toBe(2);
  });

  it("handles CRLF line endings", () => {
    expect(parseKradfile("亜 : 一 口\r\n").get("亜")).toEqual(["一", "口"]);
  });
});

describe("buildKanjiData", () => {
  it("keeps only kanji KRADFILE decomposes, adds their parts, and carries the notice", () => {
    const data = buildKanjiData(parseKanjidic(XML), new Map([["日", ["日"]]]));
    expect(Object.keys(data.kanji)).toEqual(["日"]);
    expect(data.kanji["日"]!.parts).toEqual(["日"]);
    expect(data.notice).toBe(KANJI_NOTICE);
    expect(data.notice).toContain("CC BY-SA");
  });
});
