import { eq, inArray } from "drizzle-orm";
import { db } from "../../../db/client.ts";
import { anime, card, song } from "../../../db/schema.ts";
import { createAnimeMetadataResolver } from "../../../utils/animeMetadata.ts";
import { assertOnline, OfflineModeError } from "../../../utils/networkMode.ts";

const MIN_QUERY_LENGTH = 2;

function aniListIdsWithCards(ids: number[]): Set<number> {
  if (!ids.length) return new Set();
  const rows = db
    .selectDistinct({ aniListId: anime.aniListId })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(inArray(anime.aniListId, ids))
    .all();
  return new Set(rows.map((row) => row.aniListId));
}

// Shows from AniList, library or not, for the queue search.
export default defineEventHandler(async (event) => {
  assertOnline();
  const raw = getQuery(event).q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length < MIN_QUERY_LENGTH) return { results: [] };
  try {
    const results = await createAnimeMetadataResolver().search(q);
    const owned = aniListIdsWithCards(results.map((r) => r.aniListId));
    return {
      results: results.map((r) => ({ aniListId: r.aniListId, titleEnglish: r.titleEnglish, titleRomaji: r.titleRomaji, inLibrary: owned.has(r.aniListId) })),
    };
  } catch (error) {
    if (error instanceof OfflineModeError) throw error;
    return { results: [] };
  }
});
