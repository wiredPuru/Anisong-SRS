import { listCards } from "../../../utils/cards.ts";
import { hasLocalFile } from "../../../utils/partyDownload.ts";

const MIN_QUERY_LENGTH = 2;

// Just enough to pick a song: no paths, URLs or schedule leave the host door,
// only whether a local file exists.
export default defineEventHandler((event) => {
  const raw = getQuery(event).q;
  const q = typeof raw === "string" ? raw.trim() : "";
  if (q.length < MIN_QUERY_LENGTH) return { results: [] };
  const { items } = listCards(1, q);
  return {
    results: items.map((item) => ({
      cardId: item.id,
      animeTitle: item.animeTitleEnglish,
      songTitle: item.songTitle,
      artistName: item.artistName,
      themeSlot: item.themeSlot,
      downloaded: hasLocalFile(item),
    })),
  };
});
