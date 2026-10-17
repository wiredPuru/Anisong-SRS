import { lookupKanjiInText, MAX_KANJI_TEXT } from "../utils/kanjiLookup.ts";

export default defineEventHandler((event) => {
  const text = getQuery(event).text;
  if (typeof text !== "string" || !text.trim()) {
    throw createError({ statusCode: 400, statusMessage: "text is required" });
  }
  if (text.length > MAX_KANJI_TEXT) {
    throw createError({ statusCode: 400, statusMessage: `text must be at most ${MAX_KANJI_TEXT} characters` });
  }
  setHeader(event, "cache-control", "public, max-age=86400");
  return lookupKanjiInText(text);
});
