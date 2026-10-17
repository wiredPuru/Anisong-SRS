import { describe, expect, it } from "vitest";
import { matchKey, parseDeckList, pickBest, scoreCandidate, type ListEntry } from "./deckFromList.ts";

const entry: ListEntry = {
  label: "ClariS - PRIMALove",
  songs: ["PRIMALove"],
  artists: ["ClariS"],
  anime: ["BEATLESS"],
  slot: "ED",
};

const candidate = { songTitle: "PRIMALove", artistName: "ClariS", animeTitle: "BEATLESS", themeSlot: "ED1" };

describe("matchKey", () => {
  it("folds width, case and punctuation", () => {
    expect(matchKey("Ｈｅｌｌｏ, World!")).toBe("helloworld");
    expect(matchKey("A応P")).toBe("a応p");
  });
});

describe("scoreCandidate", () => {
  it("scores an exact title, artist, anime and slot highest", () => {
    expect(scoreCandidate(entry, candidate)).toBe(29);
  });

  it("needs a title match", () => {
    expect(scoreCandidate(entry, { ...candidate, songTitle: "Connect" })).toBe(0);
  });

  it("needs the artist or the anime beside the title", () => {
    expect(scoreCandidate(entry, { ...candidate, artistName: "Someone", animeTitle: "Other Show" })).toBe(0);
    expect(scoreCandidate(entry, { ...candidate, artistName: "Someone" })).toBeGreaterThan(0);
  });

  it("treats the anime as matched when it was looked up directly", () => {
    expect(scoreCandidate(entry, { ...candidate, artistName: "Someone", animeTitle: "x" }, true)).toBeGreaterThan(0);
  });

  it("accepts a partial title of four or more characters", () => {
    const partial = { ...entry, songs: ["Hanneikyuuteki ni Aishite yo"] };
    expect(scoreCandidate(partial, { ...candidate, songTitle: "Hanneikyuuteki ni Aishite yo!!", artistName: "Yui Horie", animeTitle: "Golden Time" }, true)).toBeGreaterThan(0);
    expect(scoreCandidate({ ...entry, songs: ["Pa"] }, { ...candidate, songTitle: "Paradigm" })).toBe(0);
  });
});

describe("pickBest", () => {
  it("prefers the candidate whose slot type matches", () => {
    const op = { ...candidate, themeSlot: "OP1" };
    const ed = { ...candidate, themeSlot: "ED1" };
    expect(pickBest(entry, [op, ed])).toBe(ed);
  });

  it("returns null when nothing matches", () => {
    expect(pickBest(entry, [{ ...candidate, songTitle: "Other" }])).toBeNull();
  });
});

describe("parseDeckList", () => {
  it("fills defaults and drops blank strings", () => {
    const list = parseDeckList({ deck: " Mix ", entries: [{ songs: ["Spell", ""], artists: ["LAMA"], slot: "XX" }] });
    expect(list.deck).toBe("Mix");
    expect(list.entries[0]).toMatchObject({ label: "Spell", songs: ["Spell"], anime: [], slot: undefined });
  });

  it("rejects a list with no deck or no entries", () => {
    expect(() => parseDeckList({ entries: [{ songs: ["x"] }] })).toThrow("deck");
    expect(() => parseDeckList({ deck: "x", entries: [] })).toThrow("entry");
    expect(() => parseDeckList({ deck: "x", entries: [{ songs: [] }] })).toThrow("songs");
  });
});
