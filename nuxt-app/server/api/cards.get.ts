import { listCards } from "../utils/cards.ts";
import { PAGE_SIZE, parsePage } from "../utils/pagination.ts";

export default defineEventHandler((event) => {
  const requestedPage = parsePage(getQuery(event).page);
  const { items, total } = listCards(requestedPage);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);

  if (page !== requestedPage) {
    const clamped = listCards(page);
    return { cards: clamped.items, page, totalPages };
  }

  return { cards: items, page, totalPages };
});
