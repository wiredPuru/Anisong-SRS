import { describe, expect, it } from "vitest";
import { pickChoices, similarity, type ChoiceCandidate } from "./partyChoices.ts";
import { EMPTY_DETAILS, type PartyAnimeDetails } from "./partyLightning.ts";

const details = (genres: string[], year = 2015): PartyAnimeDetails => ({ ...EMPTY_DETAILS, genres, year, format: "TV" });
const show = (title: string, genres: string[], year?: number): ChoiceCandidate => ({ title, details: details(genres, year) });

describe("similarity", () => {
  it("scores shared genres above unrelated shows", () => {
    expect(similarity(details(["Action", "Fantasy"]), details(["Action", "Fantasy"]))).toBeGreaterThan(
      similarity(details(["Action", "Fantasy"]), details(["Romance"])),
    );
  });
});

describe("pickChoices", () => {
  const correct = details(["Action", "Fantasy"]);
  const pool = [
    ...Array.from({ length: 14 }, (_, i) => show(`Fantasy ${i}`, ["Action", "Fantasy"])),
    ...Array.from({ length: 10 }, (_, i) => show(`Romance ${i}`, ["Romance"])),
  ];

  it("returns the right title once, with the other options from look-alikes", () => {
    const options = pickChoices("Answer", correct, pool, "token", 4);
    expect(options).toHaveLength(4);
    expect(options.filter((title) => title === "Answer")).toHaveLength(1);
    expect(options.filter((title) => title !== "Answer").every((title) => title.startsWith("Fantasy"))).toBe(true);
  });

  it("is stable for a song and varies between songs", () => {
    expect(pickChoices("Answer", correct, pool, "a")).toEqual(pickChoices("Answer", correct, pool, "a"));
    const orders = new Set(Array.from({ length: 12 }, (_, i) => pickChoices("Answer", correct, pool, `t${i}`).join("|")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("never repeats the answer or a title", () => {
    const options = pickChoices("Answer", correct, [show("answer", ["Action"]), show("Dup", []), show("dup", []), show("Other", [])], "x", 4);
    expect(new Set(options.map((o) => o.toLowerCase())).size).toBe(options.length);
  });

  it("falls back to random shows when the answer has no details", () => {
    const options = pickChoices("Answer", EMPTY_DETAILS, pool, "x", 4);
    expect(options).toHaveLength(4);
  });

  it("returns fewer options when the library is small", () => {
    expect(pickChoices("Answer", correct, [show("Only", [])], "x", 4)).toHaveLength(2);
  });
});
