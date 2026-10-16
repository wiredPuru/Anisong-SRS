import { describe, expect, it } from "vitest";
import { revealFactLine } from "./partyRevealFacts";

const facts = { year: 2009, season: "SPRING", format: "TV", studios: ["Kyoto Animation"], averageScore: 79, tags: [] };

describe("revealFactLine", () => {
  it("joins season and year, format, studios and score", () => {
    expect(revealFactLine(facts)).toBe("Spring 2009 · TV · Kyoto Animation · 79%");
  });

  it("labels formats and lists several studios", () => {
    expect(revealFactLine({ ...facts, format: "MOVIE", studios: ["A-1 Pictures", "CloverWorks"] })).toBe(
      "Spring 2009 · Movie · A-1 Pictures, CloverWorks · 79%",
    );
  });

  it("shows the year alone without a season, and skips unknowns", () => {
    expect(revealFactLine({ ...facts, season: null, studios: [], averageScore: null })).toBe("2009 · TV");
    expect(revealFactLine({ ...facts, year: null })).toBe("TV · Kyoto Animation · 79%");
  });

  it("is empty with no facts at all", () => {
    expect(revealFactLine(undefined)).toBe("");
    expect(revealFactLine({ year: null, season: null, format: null, studios: [], averageScore: null, tags: [] })).toBe("");
  });
});
