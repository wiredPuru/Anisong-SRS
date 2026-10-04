import { importAnimeThemes } from "../../utils/animeImport.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.aniListId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "aniListId is required and must be a number" });
  }

  const imported = await importAnimeThemes(body.aniListId);
  if (!imported) {
    throw createError({ statusCode: 404, statusMessage: "Anime has no matching metadata" });
  }
  return imported;
});
