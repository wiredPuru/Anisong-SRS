import { describe, expect, it } from "vitest";
import { partyAnswerFacts } from "./partyAnswerFacts.ts";
import { EMPTY_DETAILS } from "./partyLightning.ts";

describe("partyAnswerFacts", () => {
  const details = {
    year: 2009,
    season: "SPRING",
    format: "TV",
    averageScore: 79,
    genres: ["Comedy", "Music", "Slice of Life"],
    tags: [
      { name: "Food", rank: 40 },
      { name: "Music", rank: 95 },
      { name: "School Club", rank: 84 },
      { name: "Female Protagonist", rank: 88 },
      { name: "Cute Girls Doing Cute Things", rank: 90 },
    ],
  };

  it("carries the show's year, season, format, score and studios", () => {
    expect(partyAnswerFacts(details, ["Kyoto Animation"])).toMatchObject({
      year: 2009,
      season: "SPRING",
      format: "TV",
      averageScore: 79,
      studios: ["Kyoto Animation"],
    });
  });

  it("keeps the three most relevant tags at rank 60 or above", () => {
    expect(partyAnswerFacts(details, []).tags).toEqual(["Music", "Cute Girls Doing Cute Things", "Female Protagonist"]);
  });

  it("falls back to genres when no tag is relevant enough", () => {
    expect(partyAnswerFacts({ ...details, tags: [{ name: "Food", rank: 40 }] }, []).tags).toEqual(["Comedy", "Music", "Slice of Life"]);
  });

  it("is empty for a show with no stored details", () => {
    expect(partyAnswerFacts(EMPTY_DETAILS, [])).toEqual({ year: null, season: null, format: null, studios: [], averageScore: null, tags: [] });
  });

  it("does not share the caller's studio array", () => {
    const studios = ["Shaft"];
    const facts = partyAnswerFacts(details, studios);
    studios.push("Other");
    expect(facts.studios).toEqual(["Shaft"]);
  });
});
