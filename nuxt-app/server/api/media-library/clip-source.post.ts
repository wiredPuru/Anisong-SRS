import { setClipSource } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.source !== "string") {
    throw createError({ statusCode: 400, statusMessage: "source is required and must be a string" });
  }

  const result = setClipSource(body.source);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
