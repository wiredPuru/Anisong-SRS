import { assertClipUrlAllowed } from "../../utils/clipSourceGuard.ts";
import { ALLOWED_MEDIA_DOMAINS, parseAllowedStreamUrl, resolveCachedPath } from "../../utils/streamCache.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const url = typeof body?.url === "string" ? body.url : "";

  if (!url || !parseAllowedStreamUrl(url)) {
    throw createError({ statusCode: 400, statusMessage: `url must be an https URL on ${ALLOWED_MEDIA_DOMAINS.join(" or ")}` });
  }
  assertClipUrlAllowed(url);

  const result = await resolveCachedPath(url);
  if ("error" in result) {
    throw createError({ statusCode: 502, statusMessage: result.error });
  }

  return { cached: true };
});
