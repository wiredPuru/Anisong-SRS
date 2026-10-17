import { parseKanjiReviewBody, reviewKanji } from "../../../utils/kanjiCards.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseKanjiReviewBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  const result = reviewKanji(parsed.char, parsed.result);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Kanji not in your deck" });
  }
  return result;
});
