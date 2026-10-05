import { parseCardListFilters } from "../utils/cardDelete.ts";
import { listCards } from "../utils/cards.ts";
import { PAGE_SIZE, parsePage } from "../utils/pagination.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const requestedPage = parsePage(query.page);
  const q = typeof query.q === "string" ? query.q : undefined;
  const parsedFilters = parseCardListFilters(query);
  if ("error" in parsedFilters) {
    throw createError({ statusCode: 400, statusMessage: parsedFilters.error });
  }
  const { filters } = parsedFilters;
  const { items, total } = listCards(requestedPage, q, filters);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);

  if (page !== requestedPage) {
    const clamped = listCards(page, q, filters);
    return { cards: clamped.items, page, totalPages, total: clamped.total };
  }

  return { cards: items, page, totalPages, total };
});
