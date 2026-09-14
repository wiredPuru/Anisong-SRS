import { parseMatchingQuery } from "../../utils/cardDelete.ts";
import { listCardIds } from "../../utils/cards.ts";

export default defineEventHandler((event) => {
  const q = parseMatchingQuery(getQuery(event).q);
  if (q === null) {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }
  return { ids: listCardIds(q) };
});
