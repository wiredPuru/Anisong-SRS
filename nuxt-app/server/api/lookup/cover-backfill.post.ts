import { fetchAnimeFromAniList } from "../../lib/anilist.ts";
import { backfillMissingCovers } from "../../utils/coverBackfill.ts";

// Goes straight to AniList rather than through createAnimeMetadataResolver:
// the AnimeThemes fallback carries no cover art at all, so falling back here
// would report every row as skipped and look like a successful no-op. A real
// outage propagates as the client's own 503 instead.
export default defineEventHandler(async () => {
  return await backfillMissingCovers(fetchAnimeFromAniList);
});
