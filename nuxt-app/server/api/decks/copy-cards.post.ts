import { parseCopyCardsBody } from "../../utils/deckMembership.ts";
import { copyCardsFromDecks } from "../../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseCopyCardsBody(await readBody(event));

  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  const result = copyCardsFromDecks(parsed.deckId, parsed.sources);

  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }

  return result;
});
