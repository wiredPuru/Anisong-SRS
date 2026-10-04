import { addCardsForThemes, importAnimeThemes } from "../../utils/animeImport.ts";

// One anime per call so a bulk import can show progress and be cancelled.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || !Number.isSafeInteger(body.aniListId) || body.aniListId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "aniListId is required and must be a positive integer" });
  }

  const imported = await importAnimeThemes(body.aniListId);
  if (!imported) {
    throw createError({ statusCode: 404, statusMessage: "Anime has no matching metadata" });
  }

  return {
    aniListId: imported.anime.aniListId,
    title: imported.anime.titleEnglish,
    ...addCardsForThemes(imported.themes),
  };
});
