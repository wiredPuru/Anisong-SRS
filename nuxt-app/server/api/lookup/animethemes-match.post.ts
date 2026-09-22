import { backfillAnimeThemesMatches, listMatchCandidates } from "../../utils/animethemesMatch.ts";
import { respondWithImportProgress } from "../../utils/importProgress.ts";

export default defineEventHandler((event) =>
  respondWithImportProgress(event, (report) => backfillAnimeThemesMatches(listMatchCandidates(), { report })));
