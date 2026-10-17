import { addKanjiCards, parseKanjiAddBody } from "../../../utils/kanjiCards.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseKanjiAddBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return addKanjiCards(parsed.chars);
});
