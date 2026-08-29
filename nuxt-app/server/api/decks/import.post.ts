import { importBundle } from "../../utils/deckImport.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.sourcePath !== "string" || !body.sourcePath.trim()) {
    throw createError({ statusCode: 400, statusMessage: "sourcePath is required" });
  }

  const result = importBundle(body.sourcePath.trim());
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
