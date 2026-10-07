import { describe, expect, it } from "vitest";
import { combinedAddedCount, summarizeDeckFilterRun } from "./deckFilterRun";
import type { ImportBatchResult } from "./importAnimeBatch";

const imports = (over: Partial<ImportBatchResult> = {}): ImportBatchResult => ({
  done: 3, total: 3, added: 9, addedToDeck: 9, failed: 0, empty: 0, current: null, cancelled: false, ...over,
});

describe("summarizeDeckFilterRun", () => {
  it("reports the library part alone", () => {
    expect(summarizeDeckFilterRun({ added: 12, alreadyInDeck: 0 }, null)).toBe("Added 12 cards from your library.");
  });

  it("notes cards already in the deck, and singular wording", () => {
    expect(summarizeDeckFilterRun({ added: 1, alreadyInDeck: 4 }, null)).toBe("Added 1 card from your library (4 already in deck).");
  });

  it("reports the AniList part alone", () => {
    expect(summarizeDeckFilterRun(null, imports())).toBe("Imported 3 shows from AniList and added 9 cards to the deck.");
    expect(summarizeDeckFilterRun(null, imports({ done: 1, total: 1, addedToDeck: 1 }))).toBe("Imported 1 show from AniList and added 1 card to the deck.");
  });

  it("joins both parts in library-then-AniList order", () => {
    expect(summarizeDeckFilterRun({ added: 5, alreadyInDeck: 0 }, imports())).toBe(
      "Added 5 cards from your library. Imported 3 shows from AniList and added 9 cards to the deck.",
    );
  });

  it("says when a run was cancelled, keeping the library part", () => {
    expect(summarizeDeckFilterRun({ added: 5, alreadyInDeck: 0 }, imports({ done: 1, total: 3, addedToDeck: 3, cancelled: true }))).toBe(
      "Added 5 cards from your library. Imported 1 show from AniList and added 3 cards to the deck. Stopped early.",
    );
  });

  it("counts failures out of the imported shows and notes shows with nothing addable", () => {
    expect(summarizeDeckFilterRun(null, imports({ failed: 1, empty: 2, addedToDeck: 4 }))).toBe(
      "Imported 2 shows from AniList and added 4 cards to the deck. 1 failed. 2 had nothing addable under your clip settings.",
    );
  });

  it("is empty when neither part ran", () => {
    expect(summarizeDeckFilterRun(null, null)).toBe("");
  });
});

describe("combinedAddedCount", () => {
  it("adds library cards and cards that joined from imports", () => {
    expect(combinedAddedCount({ added: 5, alreadyInDeck: 2 }, imports({ addedToDeck: 7 }))).toBe(12);
    expect(combinedAddedCount({ added: 5, alreadyInDeck: 0 }, null)).toBe(5);
    expect(combinedAddedCount(null, imports({ addedToDeck: 7 }))).toBe(7);
    expect(combinedAddedCount(null, null)).toBe(0);
  });
});
