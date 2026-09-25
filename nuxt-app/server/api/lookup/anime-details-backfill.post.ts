import { fetchAnimeDetailsByIds } from "../../lib/anilist.ts";
import { backfillAnimeDetails } from "../../utils/animeDetailsBackfill.ts";

// Straight to AniList, like cover-backfill: no fallback provider carries these
// fields, so an outage surfaces as the client's own 503.
export default defineEventHandler(async () => {
  return await backfillAnimeDetails(fetchAnimeDetailsByIds);
});
