import { searchKanji } from "../../utils/kanjiLookup.ts";

const MAX_QUERY = 100;

export default defineEventHandler((event) => {
  const q = getQuery(event).q;
  if (typeof q !== "string") {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }
  if (q.length > MAX_QUERY) {
    throw createError({ statusCode: 400, statusMessage: `q must be at most ${MAX_QUERY} characters` });
  }
  setHeader(event, "cache-control", "public, max-age=86400");
  return { results: searchKanji(q) };
});
