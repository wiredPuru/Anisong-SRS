import { respondWithImportProgress } from "../../utils/importProgress.ts";
import { createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import type { AniListAnime } from "../../lib/anilist.ts";
import { fetchMalCompletedList, JikanUserNotFoundError } from "../../lib/jikan.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const username = typeof query.username === "string" ? query.username.trim() : "";

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "username is required" });
  }

  return respondWithImportProgress(event, async (report) => {
    report({ label: "Fetching your MyAnimeList Completed list" });
    let malEntries;
    try {
      malEntries = await fetchMalCompletedList(username, (page, animeCount) => {
        report({ label: `Fetched MyAnimeList page ${page} (${animeCount} anime)` });
      });
    } catch (err) {
      if (err instanceof JikanUserNotFoundError) {
        throw createError({ statusCode: 404, statusMessage: err.message });
      }
      throw err;
    }

    const results: AniListAnime[] = [];
    const metadata = createAnimeMetadataResolver();
    let completed = 0;
    let skipped = 0;
    const reportResolution = () => report({
      label: "Matching MyAnimeList anime", completed, total: malEntries.length, skipped,
    });
    reportResolution();
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
      } else skipped += 1;
      completed += 1;
      reportResolution();
      // An entry with no AniList counterpart is skipped, not fatal - same
      // degrade-gracefully precedent as feature 37a's anime-import loop.
    }

    return { results };
  });
});
