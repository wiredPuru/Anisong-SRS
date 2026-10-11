import { eq } from "drizzle-orm";
import { db } from "../../../db/client.ts";
import { card, deck } from "../../../db/schema.ts";
import { linkCardsToDeck } from "../../../utils/decks.ts";

// Puts the song that is playing into one of the host's own decks. A song that
// came straight from the catalog has no card yet, so only library cards count.
export default defineEventHandler(async (event) => {
  const { deckId, cardId } = ((await readBody(event).catch(() => null)) ?? {}) as { deckId?: unknown; cardId?: unknown };
  if (!Number.isInteger(deckId) || (deckId as number) <= 0 || !Number.isInteger(cardId) || (cardId as number) <= 0) {
    throw createError({ statusCode: 400, statusMessage: "deckId and cardId must be positive integers" });
  }
  const target = db.select({ name: deck.name }).from(deck).where(eq(deck.id, deckId as number)).get();
  if (!target) throw createError({ statusCode: 404, statusMessage: "That deck no longer exists" });
  if (!db.select({ id: card.id }).from(card).where(eq(card.id, cardId as number)).get()) {
    throw createError({ statusCode: 404, statusMessage: "That song is not a card in your library" });
  }
  const { addedToDeck } = linkCardsToDeck(deckId as number, [cardId as number]);
  return { deckName: target.name, added: addedToDeck > 0 };
});
