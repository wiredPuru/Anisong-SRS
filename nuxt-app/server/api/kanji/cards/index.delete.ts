import { parseKanjiCharsBody, removeKanjiCards } from "../../../utils/kanjiCards.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseKanjiCharsBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return removeKanjiCards(parsed.chars);
});
