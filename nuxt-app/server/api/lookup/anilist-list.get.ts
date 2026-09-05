import { AniListUserNotFoundError, fetchAniListCompletedList } from "../../lib/anilist.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const username = typeof query.username === "string" ? query.username.trim() : "";

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: "username is required" });
  }

  try {
    const results = await fetchAniListCompletedList(username);
    return { results };
  } catch (err) {
    if (err instanceof AniListUserNotFoundError) {
      throw createError({ statusCode: 404, statusMessage: err.message });
    }
    throw err;
  }
});
