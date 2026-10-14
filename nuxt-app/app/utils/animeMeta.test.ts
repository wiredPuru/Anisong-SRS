import { describe, expect, it } from "vitest";
import { animeMetaLine, topAnimeTags } from "./animeMeta";

describe("animeMetaLine", () => {
  it("joins year and studios", () => {
    expect(animeMetaLine(2009, ["Kyoto Animation"])).toBe("2009 · Kyoto Animation");
  });

  it("lists several main studios", () => {
    expect(animeMetaLine(2019, ["A-1 Pictures", "CloverWorks"])).toBe("2019 · A-1 Pictures, CloverWorks");
  });

  it("shows whichever part is known", () => {
    expect(animeMetaLine(null, ["Shaft"])).toBe("Shaft");
    expect(animeMetaLine(2011, [])).toBe("2011");
  });

  it("is empty when nothing is known", () => {
    expect(animeMetaLine(null, [])).toBe("");
    expect(animeMetaLine(undefined, undefined)).toBe("");
  });
});

describe("topAnimeTags", () => {
  const tags = [
    { name: "Music", rank: 95 },
    { name: "School", rank: 70 },
    { name: "Female Protagonist", rank: 88 },
    { name: "Comedy", rank: 61 },
    { name: "Food", rank: 40 },
  ];

  it("keeps the highest-ranked tags, most relevant first", () => {
    expect(topAnimeTags(tags)).toEqual(["Music", "Female Protagonist", "School"]);
  });

  it("drops tags below the rank threshold", () => {
    expect(topAnimeTags([{ name: "Food", rank: 40 }])).toEqual([]);
    expect(topAnimeTags([{ name: "Edge", rank: 60 }])).toEqual(["Edge"]);
  });

  it("does not reorder the caller's array", () => {
    const input = [...tags];
    topAnimeTags(input);
    expect(input).toEqual(tags);
  });

  it("handles missing tags", () => {
    expect(topAnimeTags(undefined)).toEqual([]);
    expect(topAnimeTags([])).toEqual([]);
  });
});
