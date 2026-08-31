import { setBoxOneStreakRequired } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.required !== "number") {
    throw createError({ statusCode: 400, statusMessage: "required is required and must be a number" });
  }

  const result = setBoxOneStreakRequired(body.required);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
