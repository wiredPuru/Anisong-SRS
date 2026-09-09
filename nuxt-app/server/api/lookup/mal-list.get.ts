import { createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import type { AniListAnime } from "../../lib/anilist.ts";
import { fetchMalCompletedList, JikanUserNotFoundError } from "../../lib/jikan.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const username = typeof query.username === "string" ? query.username.trim() : "";

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "username is required" });
  }

  let malEntries;
  try {
    malEntries = await fetchMalCompletedList(username);
  } catch (err) {
    if (err instanceof JikanUserNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: err.message });
    }
    throw err;
  }

  const results: AniListAnime[] = [];
  const metadata = createAnimeMetadataResolver();
  for (const entry of malEntries) {
    // Resolve sequentially to avoid flooding either metadata provider.
    const anime = await metadata.byMalId(entry.malId);
    if (anime && !results.some((result) => result.aniListId === anime.aniListId)) {
      results.push({
        aniListId: anime.aniListId,
        titleRomaji: anime.titleRomaji,
        titleEnglish: anime.titleEnglish,
        titleNative: anime.titleNative,
        coverImageUrl: anime.coverImageUrl ?? null,
      });
    }
    // An entry with no AniList counterpart is skipped, not fatal - same
    // degrade-gracefully precedent as feature 37a's anime-import loop.
  }

  return { results };
});
