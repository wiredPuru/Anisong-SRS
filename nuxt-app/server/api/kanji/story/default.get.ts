import { getDefaultStory } from "../../../utils/kanjiDefaultStories.ts";
import { parseStoryChar } from "../../../utils/kanjiStories.ts";

export default defineEventHandler((event) => {
  const parsed = parseStoryChar(getQuery(event).char);
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return getDefaultStory(parsed.char);
});
