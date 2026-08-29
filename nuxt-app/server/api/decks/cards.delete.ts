import { removeCardFromDeck } from "../../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.deckId !== "number" || typeof body.cardId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "deckId and cardId are required and must be numbers" });
  }

  const result = removeCardFromDeck(body.deckId, body.cardId);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }

  return result;
});
