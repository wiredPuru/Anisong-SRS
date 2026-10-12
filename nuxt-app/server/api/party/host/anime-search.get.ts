import { createAnimeMetadataResolver } from "../../../utils/animeMetadata.ts";
import { assertOnline, OfflineModeError } from "../../../utils/networkMode.ts";

const MIN_QUERY_LENGTH = 2;

// Shows from AniList, library or not, for the queue search.
export default defineEventHandler(async (event) => {
  assertOnline();
  const raw = getQuery(event).q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length < MIN_QUERY_LENGTH) return { results: [] };
  try {
    const results = await createAnimeMetadataResolver().search(q);
    return { results: results.map((r) => ({ aniListId: r.aniListId, titleEnglish: r.titleEnglish, titleRomaji: r.titleRomaji })) };
  } catch (error) {
    if (error instanceof OfflineModeError) throw error;
    return { results: [] };
  }
});
