import { getKanjiStory, parseStoryChar } from "../../../utils/kanjiStories.ts";

export default defineEventHandler((event) => {
  const parsed = parseStoryChar(getQuery(event).char);
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return { char: parsed.char, text: getKanjiStory(parsed.char) };
});
