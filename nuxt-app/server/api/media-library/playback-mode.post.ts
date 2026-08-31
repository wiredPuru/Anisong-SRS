import { setPlaybackMode } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.mode !== "string") {
    throw createError({ statusCode: 400, statusMessage: "mode is required and must be a string" });
  }

  const result = setPlaybackMode(body.mode);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
