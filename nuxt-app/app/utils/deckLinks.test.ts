import { describe, expect, it } from "vitest";
import { animeCardsSearchPath, animeDeckPath, artistDeckPath, artistLinkPath, mainAppHref } from "./deckLinks.ts";

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

describe("animeCardsSearchPath", () => {
  const q = (path: string) => new URLSearchParams(path.slice(path.indexOf("?") + 1)).get("q");

  it("seeds /cards with the title", () => {
    expect(animeCardsSearchPath("Higurashi no Naku Koro ni Kai")).toBe(
      "/cards?q=Higurashi%20no%20Naku%20Koro%20ni%20Kai",
    );
  });

  it("round-trips characters that would break a query string", () => {
    for (const title of ["Fate/stay night & more", "Re:Zero #1", "ひぐらしのなく頃に"]) {
      expect(q(animeCardsSearchPath(title))).toBe(title);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(q(animeCardsSearchPath("  Clannad  "))).toBe("Clannad");
  });

  it("falls back to plain /cards for a blank title", () => {
    expect(animeCardsSearchPath("   ")).toBe("/cards");
  });
});

describe("mainAppHref", () => {
  it("joins the main app's base and a path", () => {
    expect(mainAppHref("http://127.0.0.1:3000", "/cards?q=K-On")).toBe("http://127.0.0.1:3000/cards?q=K-On");
  });

  it("copes with trailing slashes on the base", () => {
    expect(mainAppHref("http://127.0.0.1:3100/", "/decks?type=artist&id=3")).toBe("http://127.0.0.1:3100/decks?type=artist&id=3");
    expect(mainAppHref("http://127.0.0.1:3100//", "/cards")).toBe("http://127.0.0.1:3100/cards");
  });

  it("adds the slash a bare path is missing", () => {
    expect(mainAppHref("http://127.0.0.1:3000", "cards")).toBe("http://127.0.0.1:3000/cards");
  });
});

describe("artistLinkPath", () => {
  it("opens the artist's deck when there is a library artist", () => {
    expect(artistLinkPath(42, "Ho-Kago Tea Time")).toBe("/decks?type=artist&id=42");
  });

  it("searches /cards by name for an artist with no library row", () => {
    expect(artistLinkPath(null, "Ho-Kago Tea Time")).toBe("/cards?q=Ho-Kago%20Tea%20Time");
  });
});
