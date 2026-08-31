import { parseAllowedStreamUrl, resolveCachedPath } from "../../utils/streamCache.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const url = typeof body?.url === "string" ? body.url : "";

  if (!url || !parseAllowedStreamUrl(url)) {
    throw createError({ statusCode: 400, statusMessage: "url must be an https animethemes.moe URL" });
  }

  const result = await resolveCachedPath(url);
  if ("error" in result) {
    throw createError({ statusCode: 502, statusMessage: result.error });
  }

  return { cached: true };
});
