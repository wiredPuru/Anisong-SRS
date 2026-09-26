import { getIncludeInsertSongs } from "../../utils/mediaLibrary.ts";
import { searchArtistCandidates } from "../../utils/artistSource.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = typeof query.q === "string" ? query.q.trim() : "";

  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }

  const results = await searchArtistCandidates(q, { includeInserts: getIncludeInsertSongs() });
  return { results };
});
