export const BULK_DECK_ADD_MAX = 500;

export type DeckCardsBody =
  | { kind: "single"; deckId: number; cardId: number }
  | { kind: "bulk"; deckId: number; cardIds: number[] };

function isRowId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Validates a POST/DELETE /api/decks/cards body, returning an error message when it is unusable. */
export function parseDeckCardsBody(body: unknown): DeckCardsBody | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "deckId and cardId or cardIds are required" };
  }
  const { deckId, cardId, cardIds } = body as { deckId?: unknown; cardId?: unknown; cardIds?: unknown };

  if (typeof deckId !== "number") {
    return { error: "deckId is required and must be a number" };
  }

  if (cardIds !== undefined) {
    if (!Array.isArray(cardIds) || cardIds.length === 0) return { error: "cardIds must be a non-empty array" };
    if (cardIds.length > BULK_DECK_ADD_MAX) {
      return { error: `cardIds may hold at most ${BULK_DECK_ADD_MAX} entries` };
    }
    if (!cardIds.every(isRowId)) return { error: "cardIds must all be positive integers" };
    return { kind: "bulk", deckId, cardIds };
  }

  if (typeof cardId !== "number") return { error: "cardId is required and must be a number" };
  return { kind: "single", deckId, cardId };
}
