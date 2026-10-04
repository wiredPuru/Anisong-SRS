import { addCardsForThemes, importAnimeThemes } from "../../utils/animeImport.ts";
import { getManualDeckLabel, linkCardsToDeck } from "../../utils/decks.ts";

// One anime per call so a bulk import can show progress and be cancelled.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || !Number.isSafeInteger(body.aniListId) || body.aniListId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "aniListId is required and must be a positive integer" });
  }
  const hasDeck = body.deckId !== undefined && body.deckId !== null;
  if (hasDeck && (!Number.isSafeInteger(body.deckId) || body.deckId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: "deckId must be a positive integer" });
  }
  // Checked before any lookup, so a missing deck imports nothing.
  if (hasDeck && getManualDeckLabel(body.deckId) === undefined) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }

  const imported = await importAnimeThemes(body.aniListId);
  if (!imported) {
    throw createError({ statusCode: 404, statusMessage: "Anime has no matching metadata" });
  }

  const { cardIds, ...counts } = addCardsForThemes(imported.themes);
  return {
    aniListId: imported.anime.aniListId,
    title: imported.anime.titleEnglish,
    ...counts,
    ...(hasDeck ? linkCardsToDeck(body.deckId, cardIds) : {}),
  };
});
