import { hasAnyCardsIdsFilter, parseMatchingQuery } from "../../utils/cardDelete.ts";
import { listCardIds } from "../../utils/cards.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const q = parseMatchingQuery(query.q);
  const missingAnimeThemesMatch = query.missingAnimeThemes === "1";
  if (!hasAnyCardsIdsFilter(q, missingAnimeThemesMatch)) {
    throw createError({ statusCode: 400, statusMessage: "q or missingAnimeThemes is required" });
  }
  return { ids: listCardIds(q ?? "", missingAnimeThemesMatch) };
});
