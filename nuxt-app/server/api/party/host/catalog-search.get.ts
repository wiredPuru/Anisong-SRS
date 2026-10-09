import { searchSongs } from "../../../lib/anisongdb.ts";
import { getIncludeInsertSongs } from "../../../utils/mediaLibrary.ts";
import { rememberCatalogSearch } from "../../../utils/partyStore.ts";

const MIN_QUERY_LENGTH = 2;

// Songs from AnisongDB's whole catalog, whether or not the library has a card.
export default defineEventHandler(async (event) => {
  const raw = getQuery(event).q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length < MIN_QUERY_LENGTH) return { results: [] };
  try {
    const results = await searchSongs(q, { includeInserts: getIncludeInsertSongs() });
    rememberCatalogSearch(results);
    return {
      results: results.map((song) => ({
        annSongId: song.annSongId,
        animeTitle: song.animeTitleRomaji,
        songTitle: song.songTitle,
        artistName: song.artistName ?? "Unknown artist",
        themeSlot: song.themeSlot,
      })),
    };
  } catch {
    return { results: [] };
  }
});
