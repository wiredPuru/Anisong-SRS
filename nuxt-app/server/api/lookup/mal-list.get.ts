import { fetchAnimeFromAniListByMalId, type AniListAnime } from "../../lib/anilist.ts";
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
  for (const entry of malEntries) {
    // Sequential, not parallel: one MAL entry per AniList round-trip is
    // already a lot of requests for a large list, matching the same
    // good-API-citizen reasoning as feature 37b's sequential downloads.
    const anime = await fetchAnimeFromAniListByMalId(entry.malId);
    if (anime) results.push(anime);
    // An entry with no AniList counterpart is skipped, not fatal - same
    // degrade-gracefully precedent as feature 37a's anime-import loop.
  }

  return { results };
});
