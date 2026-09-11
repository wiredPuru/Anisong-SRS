import { respondWithImportProgress } from "../../utils/importProgress.ts";
import { AniListUserNotFoundError, fetchAniListCompletedList } from "../../lib/anilist.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const username = typeof query.username === "string" ? query.username.trim() : "";

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "username is required" });
  }

  return respondWithImportProgress(event, async (report) => {
    report({ label: "Fetching your AniList Completed list" });
    try {
      const results = await fetchAniListCompletedList(username);
      report({ label: "Fetched AniList Completed list", completed: results.length, total: results.length });
      return { results };
    } catch (err) {
      if (err instanceof AniListUserNotFoundError) {
        throw createError({ statusCode: 404, statusMessage: err.message });
      }
      throw err;
    }
  });
});
