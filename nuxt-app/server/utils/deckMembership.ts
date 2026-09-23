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

export const COPY_SOURCES_MAX = 50;

export type DeckSource = { type: "artist" | "anime" | "created"; id: number };

const DECK_SOURCE_TYPES: readonly string[] = ["artist", "anime", "created"];

function isDeckSource(value: unknown): value is DeckSource {
  if (typeof value !== "object" || value === null) return false;
  const { type, id } = value as { type?: unknown; id?: unknown };
  return typeof type === "string" && DECK_SOURCE_TYPES.includes(type) && isRowId(id);
}

/** Validates a POST /api/decks/copy-cards body, deduping repeated sources. */
export function parseCopyCardsBody(body: unknown): { deckId: number; sources: DeckSource[] } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "deckId and sources are required" };
  const { deckId, sources } = body as { deckId?: unknown; sources?: unknown };

  if (!isRowId(deckId)) return { error: "deckId must be a positive integer" };
  if (!Array.isArray(sources) || sources.length === 0) return { error: "sources must be a non-empty array" };
  if (!sources.every(isDeckSource)) {
    return { error: "each source needs a type of artist, anime, or created and a positive integer id" };
  }

  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    const key = `${s.type}:${s.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length > COPY_SOURCES_MAX) return { error: `sources may hold at most ${COPY_SOURCES_MAX} decks` };
  if (unique.some((s) => s.type === "created" && s.id === deckId)) {
    return { error: "a deck cannot import cards from itself" };
  }

  return { deckId, sources: unique.map(({ type, id }) => ({ type, id })) };
}
