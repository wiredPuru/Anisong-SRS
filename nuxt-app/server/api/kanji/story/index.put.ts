import { parseStoryPutBody, saveKanjiStory } from "../../../utils/kanjiStories.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseStoryPutBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return saveKanjiStory(parsed.char, parsed.text);
});
