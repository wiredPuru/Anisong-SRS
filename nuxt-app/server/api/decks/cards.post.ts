import { addCardToDeck } from "../../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.deckId !== "number" || typeof body.cardId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "deckId and cardId are required and must be numbers" });
  }

  const result = addCardToDeck(body.deckId, body.cardId);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck or card not found" });
  }

  return result;
});
