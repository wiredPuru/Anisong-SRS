import { recordReview } from "../../utils/study.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.cardId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "cardId is required and must be a number" });
  }
  if (body.result !== "pass" && body.result !== "fail") {
    throw createError({ statusCode: 400, statusMessage: "result must be 'pass' or 'fail'" });
  }

  const result = recordReview(body.cardId, body.result);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }

  return result;
});
