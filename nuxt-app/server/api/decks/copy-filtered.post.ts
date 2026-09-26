import { copyFilteredCards, parseCopyFilteredBody } from "../../utils/deckFilterPreview.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseCopyFilteredBody(await readBody(event));

  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  const result = copyFilteredCards(parsed.deckId, parsed.animeIds, parsed.filters);

  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }

  return result;
});
