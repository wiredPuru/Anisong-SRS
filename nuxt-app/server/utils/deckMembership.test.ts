import { describe, expect, it } from "vitest";
import { BULK_DECK_ADD_MAX, parseDeckCardsBody } from "./deckMembership.ts";

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
