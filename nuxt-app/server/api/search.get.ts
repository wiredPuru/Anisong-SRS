import { searchCards } from "../utils/cards.ts";

export default defineEventHandler((event) => {
  const { q } = getQuery(event);
  const query = typeof q === "string" ? q.trim() : "";

  if (query.length < 2) {
    return { cards: [] };
  }

  return { cards: searchCards(query) };
});
