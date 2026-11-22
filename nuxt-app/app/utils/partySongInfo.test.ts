import { describe, expect, it } from "vitest";
import { songInfoRows } from "./partySongInfo";

const facts = { year: 2022, season: "SPRING", format: "TV", studios: ["Lay-duce"], averageScore: 71, tags: ["Idols (Male)", "School"] };

describe("songInfoRows", () => {
  it("lists every fact in order", () => {
    expect(songInfoRows(facts)).toEqual([
      { label: "Aired", value: "Spring 2022" },
      { label: "Format", value: "TV" },
      { label: "AniList score", value: "71%" },
      { label: "Studio", value: "Lay-duce" },
      { label: "Tags", value: "Idols (Male), School" },
    ]);
  });

  it("names several studios in the plural and labels formats", () => {
    const rows = songInfoRows({ ...facts, format: "MOVIE", studios: ["A-1 Pictures", "CloverWorks"] });
    expect(rows).toContainEqual({ label: "Format", value: "Movie" });
    expect(rows).toContainEqual({ label: "Studios", value: "A-1 Pictures, CloverWorks" });
  });

  it("shows the year alone without a season", () => {
    expect(songInfoRows({ ...facts, season: null })[0]).toEqual({ label: "Aired", value: "2022" });
  });

  it("drops rows the show has no value for", () => {
    const rows = songInfoRows({ ...facts, year: null, averageScore: null, studios: [], tags: [] });
    expect(rows.map((row) => row.label)).toEqual(["Format"]);
    expect(songInfoRows({ year: null, season: null, format: null, studios: [], averageScore: null, tags: [] })).toEqual([]);
    expect(songInfoRows(undefined)).toEqual([]);
  });
});

