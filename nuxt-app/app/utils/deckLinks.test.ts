import { describe, expect, it } from "vitest";
import { animeDeckPath, artistDeckPath } from "./deckLinks.ts";

// Mirrors how /decks reads its own params (pages/decks/index.vue: activeType
// defaults to "artist" for anything but "anime"/"created", selectedId is
// Number() guarded by Number.isFinite). A built path that does not survive
// this is a dead link even though the string looks right.
function parseDeckPath(path: string) {
  const query = new URLSearchParams(path.slice(path.indexOf("?") + 1));
  const raw = query.get("id");
  const id = raw === null ? null : Number(raw);
  return {
    type: query.get("type") === "anime" ? "anime" : query.get("type") === "created" ? "created" : "artist",
    id: id !== null && Number.isFinite(id) ? id : null,
  };
}

describe("artistDeckPath", () => {
  it("builds the artist deck detail route", () => {
    expect(artistDeckPath(12)).toBe("/decks?type=artist&id=12");
  });

  it("round-trips through the parsing /decks does", () => {
    expect(parseDeckPath(artistDeckPath(3))).toEqual({ type: "artist", id: 3 });
  });
});

describe("animeDeckPath", () => {
  it("builds the anime deck detail route", () => {
    expect(animeDeckPath(45)).toBe("/decks?type=anime&id=45");
  });

  it("round-trips through the parsing /decks does", () => {
    expect(parseDeckPath(animeDeckPath(59))).toEqual({ type: "anime", id: 59 });
  });
});

describe("deck paths", () => {
  it("keeps the two deck types distinct for the same id", () => {
    expect(artistDeckPath(7)).not.toBe(animeDeckPath(7));
  });
});
