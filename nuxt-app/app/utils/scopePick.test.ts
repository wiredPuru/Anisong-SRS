import { describe, expect, it } from "vitest";
import { deckRowLabel, isSameScope, scopeToQuery } from "./scopePick";

describe("scopeToQuery", () => {
  it("gives only a type for all decks", () => {
    expect(scopeToQuery({ type: "all" })).toEqual({ type: "all" });
  });

  it.each(["artist", "anime", "created"] as const)("gives type and a string id for %s", (type) => {
    expect(scopeToQuery({ type, id: 7 })).toEqual({ type, id: "7" });
  });
});

describe("isSameScope", () => {
  it("matches all against all", () => {
    expect(isSameScope({ type: "all" }, { type: "all" })).toBe(true);
  });

  it("never matches all against a deck", () => {
    expect(isSameScope({ type: "all" }, { type: "anime", id: 1 })).toBe(false);
    expect(isSameScope({ type: "anime", id: 1 }, { type: "all" })).toBe(false);
  });

  it("matches the same type and id", () => {
    expect(isSameScope({ type: "created", id: 3 }, { type: "created", id: 3 })).toBe(true);
  });

  it("separates the same id under different types", () => {
    expect(isSameScope({ type: "artist", id: 3 }, { type: "anime", id: 3 })).toBe(false);
  });

  it("separates different ids", () => {
    expect(isSameScope({ type: "anime", id: 3 }, { type: "anime", id: 4 })).toBe(false);
  });

  it("matches nothing while the scope is unknown", () => {
    expect(isSameScope(null, { type: "all" })).toBe(false);
  });
});

describe("deckRowLabel", () => {
  it("uses the English anime title", () => {
    expect(deckRowLabel("anime", { titleEnglish: "Attack on Titan", titleRomaji: "Shingeki no Kyojin" })).toBe(
      "Attack on Titan",
    );
  });

  it("falls back to Romaji when English is empty or missing", () => {
    expect(deckRowLabel("anime", { titleEnglish: "", titleRomaji: "Shingeki no Kyojin" })).toBe("Shingeki no Kyojin");
    expect(deckRowLabel("anime", { titleRomaji: "Shingeki no Kyojin" })).toBe("Shingeki no Kyojin");
  });

  it("uses name for artist and created decks", () => {
    expect(deckRowLabel("artist", { name: "Yui" })).toBe("Yui");
    expect(deckRowLabel("created", { name: "Favourites" })).toBe("Favourites");
  });

  it("returns an empty string when nothing is known", () => {
    expect(deckRowLabel("anime", {})).toBe("");
    expect(deckRowLabel("created", {})).toBe("");
  });
});
