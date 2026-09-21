import { setThemesOnly } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.enabled !== "boolean") {
    throw createError({ statusCode: 400, statusMessage: "enabled is required and must be a boolean" });
  }

  const result = setThemesOnly(body.enabled);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
