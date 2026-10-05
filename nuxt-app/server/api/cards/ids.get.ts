import { hasAnyCardsIdsFilter, parseCardListFilters, parseMatchingQuery } from "../../utils/cardDelete.ts";
import { listCardIds } from "../../utils/cards.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const q = parseMatchingQuery(query.q);
  const parsedFilters = parseCardListFilters(query);
  if ("error" in parsedFilters) {
    throw createError({ statusCode: 400, statusMessage: parsedFilters.error });
  }
  const { filters } = parsedFilters;
  if (!hasAnyCardsIdsFilter(q, filters)) {
    throw createError({ statusCode: 400, statusMessage: "q, missingAnimeThemes, suspended, downloaded, or filters is required" });
  }
  return { ids: listCardIds(q ?? "", filters) };
});
