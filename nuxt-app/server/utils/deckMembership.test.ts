import { describe, expect, it } from "vitest";
import { BULK_DECK_ADD_MAX, COPY_SOURCES_MAX, parseCopyCardsBody, parseDeckCardsBody } from "./deckMembership.ts";

describe("parseDeckCardsBody", () => {
  it("accepts a single cardId", () => {
    expect(parseDeckCardsBody({ deckId: 2, cardId: 7 })).toEqual({ kind: "single", deckId: 2, cardId: 7 });
  });

  it("accepts a list of cardIds", () => {
    expect(parseDeckCardsBody({ deckId: 2, cardIds: [1, 2, 3] })).toEqual({
      kind: "bulk",
      deckId: 2,
      cardIds: [1, 2, 3],
    });
  });

  it("prefers cardIds when a body carries both", () => {
    expect(parseDeckCardsBody({ deckId: 2, cardId: 7, cardIds: [1] })).toEqual({
      kind: "bulk",
      deckId: 2,
      cardIds: [1],
    });
  });

  it.each([[{ cardId: 7 }], [{ deckId: "2", cardId: 7 }], [{ deckId: 2 }], [{ deckId: 2, cardId: "7" }]])(
    "rejects a malformed body %j",
    (body) => {
      expect(parseDeckCardsBody(body)).toHaveProperty("error");
    },
  );

  it.each([[null], [undefined], ["deckId=2"], [42]])("rejects a non-object body %j", (body) => {
    expect(parseDeckCardsBody(body)).toHaveProperty("error");
  });

  it("rejects an empty cardIds list", () => {
    expect(parseDeckCardsBody({ deckId: 2, cardIds: [] })).toHaveProperty("error");
  });

  it.each([[[1, 2.5]], [[1, -3]], [[1, "2"]], [[0]]])("rejects non-positive-integer cardIds %j", (cardIds) => {
    expect(parseDeckCardsBody({ deckId: 2, cardIds })).toHaveProperty("error");
  });

  it("rejects more than the bulk limit", () => {
    const cardIds = Array.from({ length: BULK_DECK_ADD_MAX + 1 }, (_, i) => i + 1);
    expect(parseDeckCardsBody({ deckId: 2, cardIds })).toHaveProperty("error");
  });

  it("accepts exactly the bulk limit", () => {
    const cardIds = Array.from({ length: BULK_DECK_ADD_MAX }, (_, i) => i + 1);
    expect(parseDeckCardsBody({ deckId: 2, cardIds })).toEqual({ kind: "bulk", deckId: 2, cardIds });
  });
});

describe("parseCopyCardsBody", () => {
  it("accepts every source type", () => {
    const sources = [
      { type: "artist", id: 1 },
      { type: "anime", id: 2 },
      { type: "created", id: 3 },
    ];
    expect(parseCopyCardsBody({ deckId: 9, sources })).toEqual({ deckId: 9, sources });
  });

  it("dedupes repeated sources and drops extra keys", () => {
    const sources = [
      { type: "artist", id: 1, name: "Yui Hori" },
      { type: "artist", id: 1 },
      { type: "anime", id: 1 },
    ];
    expect(parseCopyCardsBody({ deckId: 9, sources })).toEqual({
      deckId: 9,
      sources: [
        { type: "artist", id: 1 },
        { type: "anime", id: 1 },
      ],
    });
  });

  it.each([[null], [undefined], ["deckId=2"], [{ sources: [{ type: "artist", id: 1 }] }], [{ deckId: 0, sources: [] }]])(
    "rejects a malformed body %j",
    (body) => {
      expect(parseCopyCardsBody(body)).toHaveProperty("error");
    },
  );

  it("rejects an empty or missing sources list", () => {
    expect(parseCopyCardsBody({ deckId: 9, sources: [] })).toHaveProperty("error");
    expect(parseCopyCardsBody({ deckId: 9 })).toHaveProperty("error");
  });

  it.each([[{ type: "song", id: 1 }], [{ type: "artist", id: 0 }], [{ type: "anime", id: "2" }], [{ id: 3 }], [7]])(
    "rejects a bad source %j",
    (source) => {
      expect(parseCopyCardsBody({ deckId: 9, sources: [source] })).toHaveProperty("error");
    },
  );

  it("rejects importing a deck into itself", () => {
    expect(parseCopyCardsBody({ deckId: 9, sources: [{ type: "created", id: 9 }] })).toHaveProperty("error");
  });

  it("allows an artist or anime id equal to the target deck id", () => {
    expect(parseCopyCardsBody({ deckId: 9, sources: [{ type: "artist", id: 9 }] })).not.toHaveProperty("error");
  });

  it("enforces the source limit after deduping", () => {
    const many = Array.from({ length: COPY_SOURCES_MAX + 1 }, (_, i) => ({ type: "anime", id: i + 1 }));
    expect(parseCopyCardsBody({ deckId: 9, sources: many })).toHaveProperty("error");
    const dupes = Array.from({ length: COPY_SOURCES_MAX + 10 }, () => ({ type: "anime", id: 1 }));
    expect(parseCopyCardsBody({ deckId: 9, sources: dupes })).not.toHaveProperty("error");
  });
});
