import { fetchAnimeFromAniList } from "../../lib/anilist.ts";
import { fetchThemesByMalId } from "../../lib/anisongdb.ts";
import { refreshCardSources } from "../../utils/cardSourceRefresh.ts";
import { respondWithImportProgress } from "../../utils/importProgress.ts";

// Goes straight to AniList rather than through createAnimeMetadataResolver, for
// the same reason cover-backfill does: its fallbacks (a stored Anime row,
// AnimeThemes metadata) carry no MAL id, which is the only field this needs, so
// falling back would report every anime as skipped and look like a successful
// no-op. A real outage propagates as the client's own 503 instead.
export default defineEventHandler((event) =>
  respondWithImportProgress(event, (report) =>
    refreshCardSources({ fetchAnime: fetchAnimeFromAniList, fetchThemes: fetchThemesByMalId }, report)));
