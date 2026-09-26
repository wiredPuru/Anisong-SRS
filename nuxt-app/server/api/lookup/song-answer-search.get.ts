import { getIncludeInsertSongs } from "../../utils/mediaLibrary.ts";
import { searchSongEntries } from "../../utils/songSource.ts";
import { toSongAnswerOptions } from "../../utils/songAnswerOptions.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === "string" ? query.q.trim() : "";

  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }

  return { results: toSongAnswerOptions(await searchSongEntries(q, { includeInserts: getIncludeInsertSongs() })) };
});
