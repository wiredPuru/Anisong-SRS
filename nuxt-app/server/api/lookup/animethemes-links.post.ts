import { backfillAnimeThemesLinks, listLinkCandidates } from "../../utils/animethemesLinkBackfill.ts";
import { respondWithImportProgress } from "../../utils/importProgress.ts";

export default defineEventHandler((event) =>
  respondWithImportProgress(event, (report) => backfillAnimeThemesLinks(listLinkCandidates(), { report })));
