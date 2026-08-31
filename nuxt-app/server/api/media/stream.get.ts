import { getMimeType, serveRangedFile } from "../../utils/rangedFile.ts";
import { parseAllowedStreamUrl, resolveCachedPath } from "../../utils/streamCache.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = typeof query.url === "string" ? query.url : "";

  if (!url) {
    throw createError({ statusCode: 400, statusMessage: "url is required" });
  }

  const parsed = parseAllowedStreamUrl(url);
  if (!parsed) {
    throw createError({ statusCode: 400, statusMessage: "url must be an https animethemes.moe URL" });
  }

  const result = await resolveCachedPath(url);
  if ("error" in result) {
    throw createError({ statusCode: 502, statusMessage: result.error });
  }

  return serveRangedFile(event, result.path, getMimeType(parsed.pathname));
});
