import { setDailyNewCardLimit } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || (typeof body.limit !== "number" && body.limit !== null)) {
    throw createError({ statusCode: 400, statusMessage: "limit is required and must be a number or null" });
  }

  const result = setDailyNewCardLimit(body.limit);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
