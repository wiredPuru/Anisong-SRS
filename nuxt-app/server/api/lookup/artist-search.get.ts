import { searchArtistsOnAnimeThemes } from "../../lib/animethemes.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === "string" ? query.q.trim() : "";

  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }

  const results = await searchArtistsOnAnimeThemes(q);
  return { results };
});
