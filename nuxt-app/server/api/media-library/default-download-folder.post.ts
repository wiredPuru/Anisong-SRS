import { setDefaultDownloadFolder } from "../../utils/mediaLibrary.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.path !== "string") {
    throw createError({ statusCode: 400, statusMessage: "path is required and must be a string" });
  }

  const result = setDefaultDownloadFolder(body.path);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
