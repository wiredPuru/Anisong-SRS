import { applyCardSource, parseApplySourceBody } from "../../utils/cardSource.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseApplySourceBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  const result = applyCardSource(parsed);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }
  if ("error" in result) {
    throw createError({ statusCode: 403, statusMessage: result.error });
  }
  return result;
});
