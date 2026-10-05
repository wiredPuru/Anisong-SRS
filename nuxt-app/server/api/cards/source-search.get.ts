import { ProviderUnavailableError } from "../../lib/graphql.ts";
import { searchSourceCandidates } from "../../utils/cardSource.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }
  const aniListId = Number(query.animeAniListId);
  const animeAniListId = Number.isSafeInteger(aniListId) && aniListId > 0 ? aniListId : null;

  try {
    return { results: await searchSourceCandidates(q, animeAniListId) };
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: "AnisongDB and AnimeThemes.moe are unreachable right now. Try again later." });
    }
    throw createError({ statusCode: 502, statusMessage: "Couldn't search for another source." });
  }
});
