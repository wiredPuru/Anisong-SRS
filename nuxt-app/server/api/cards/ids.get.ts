import { hasAnyCardsIdsFilter, parseCardListFilters, parseMatchingQuery } from "../../utils/cardDelete.ts";
import { listCardIds } from "../../utils/cards.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const q = parseMatchingQuery(query.q);
  const filters = parseCardListFilters(query);
  if (!hasAnyCardsIdsFilter(q, filters)) {
    throw createError({ statusCode: 400, statusMessage: "q, missingAnimeThemes, or suspended is required" });
  }
  return { ids: listCardIds(q ?? "", filters) };
});
