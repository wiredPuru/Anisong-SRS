import { addCardToDeck, addCardsToDeck } from "../../utils/decks.ts";
import { parseDeckCardsBody } from "../../utils/deckMembership.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseDeckCardsBody(await readBody(event));

  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  const result =
    parsed.kind === "bulk"
      ? addCardsToDeck(parsed.deckId, parsed.cardIds)
      : addCardToDeck(parsed.deckId, parsed.cardId);

  if ("notFound" in result && result.notFound === true) {
    throw createError({ statusCode: 404, statusMessage: "Deck or card not found" });
  }

  return result;
});
