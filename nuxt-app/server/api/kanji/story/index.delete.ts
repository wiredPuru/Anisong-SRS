import { deleteKanjiStory, parseStoryChar } from "../../../utils/kanjiStories.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = parseStoryChar(typeof body === "object" && body !== null ? (body as Record<string, unknown>).char : undefined);
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return deleteKanjiStory(parsed.char);
});
