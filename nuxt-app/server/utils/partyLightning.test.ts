import { describe, expect, it } from "vitest";
import { clueItems, lightningHints, maskTitle, revealedCount, tagItems, type PartyAnimeDetails } from "./partyLightning.ts";

const DETAILS: PartyAnimeDetails = {
  year: 2010,
  season: "SPRING",
  format: "TV",
  averageScore: 85,
  genres: ["Comedy", "Music", "Slice of Life", "Drama"],
  tags: [
    { name: "Band", rank: 95 },
    { name: "School Club", rank: 99 },
    { name: "Female Protagonist", rank: 80 },
  ],
};
const item = (details = DETAILS) => ({ token: "abc123", details, answer: { animeTitleEnglish: "K-On!! Season 2" } });

describe("clueItems / tagItems", () => {
  it("builds labelled clues, skipping what is missing", () => {
    expect(clueItems(DETAILS)).toEqual([
      { label: "Aired", value: "Spring 2010" },
      { label: "Format", value: "TV" },
      { label: "AniList score", value: "85%" },
      { label: "Genres", value: "Comedy, Music, Slice of Life" },
    ]);
    expect(clueItems({ ...DETAILS, season: null, format: "TV_SHORT", averageScore: null, genres: [] })).toEqual([
      { label: "Aired", value: "2010" },
      { label: "Format", value: "TV short" },
    ]);
  });

  it("orders tags by rank", () => {
    expect(tagItems(DETAILS)).toEqual(["School Club", "Band", "Female Protagonist"]);
  });
});

describe("revealedCount", () => {
  it("shows the first at once, spreads the rest, and all at the deadline", () => {
    expect(revealedCount(4, 0, 12)).toBe(1);
    expect(revealedCount(4, 6, 12)).toBe(3);
    expect(revealedCount(4, 11.9, 12)).toBe(4);
    expect(revealedCount(4, 12, 12)).toBe(4);
    expect(revealedCount(0, 5, 12)).toBe(0);
  });
});

describe("maskTitle", () => {
  it("hides every letter and digit at the start but keeps spaces and punctuation", () => {
    expect(maskTitle("K-On!! Season 2", "seed", 0, 12)).toBe("_-__!! ______ _");
  });

  it("shows the whole title at the deadline", () => {
    expect(maskTitle("K-On!! Season 2", "seed", 12, 12)).toBe("K-On!! Season 2");
  });

  it("reveals about half the letters halfway, in an order fixed by the seed", () => {
    const half = maskTitle("K-On!! Season 2", "seed", 6, 12);
    expect([...half].filter((char) => char === "_").length).toBe(5);
    expect(maskTitle("K-On!! Season 2", "seed", 6, 12)).toBe(half);
    expect(maskTitle("K-On!! Season 2", "other", 6, 12)).not.toBe(half);
  });

  it("handles Japanese characters as letters", () => {
    expect(maskTitle("けいおん!", "s", 0, 10)).toBe("____!");
  });
});

describe("lightningHints", () => {
  it("builds hints for the hint modes only", () => {
    expect(lightningHints(item(), "clues", 0, 12)).toEqual({ kind: "clues", items: [{ label: "Aired", value: "Spring 2010" }] });
    expect(lightningHints(item(), "tags", 12, 12)).toEqual({ kind: "tags", items: ["School Club", "Band", "Female Protagonist"] });
    expect(lightningHints(item(), "title", 0, 12)).toEqual({ kind: "title", masked: "_-__!! ______ _" });
    expect(lightningHints(item(), "regular", 5, 12)).toBeNull();
    expect(lightningHints(item(), "cover", 5, 12)).toBeNull();
  });
});
