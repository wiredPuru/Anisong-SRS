import { recordReview } from "../../utils/study.ts";
import { parseReviewBody } from "../../utils/studyReview.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseReviewBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  const result = recordReview(parsed.cardId, parsed.result, parsed.criterion);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }

  return result;
});
