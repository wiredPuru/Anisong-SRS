import { fetchAnimeFromAniList } from "../../lib/anilist.ts";
import { fetchThemesByMalId } from "../../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../../lib/graphql.ts";
import { refreshCardSources } from "../../utils/cardSourceRefresh.ts";

// One card's Re-source from the library health check. Same matcher and host
// rules as the Settings-wide action in lookup/source-refresh.post.ts.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const cardId = body?.cardId;
  if (typeof cardId !== "number" || !Number.isInteger(cardId) || cardId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "cardId must be a positive integer" });
  }

  try {
    const result = await refreshCardSources(
      { fetchAnime: fetchAnimeFromAniList, fetchThemes: fetchThemesByMalId },
      () => {},
      [cardId],
    );
    return { updated: result.updated > 0 };
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: "AniList or AnisongDB is unreachable right now. Try again later." });
    }
    throw createError({ statusCode: 502, statusMessage: "Couldn't look up a new source for this card." });
  }
});
