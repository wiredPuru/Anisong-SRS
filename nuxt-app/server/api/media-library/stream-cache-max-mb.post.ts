import { setStreamCacheMaxBytes } from "../../utils/mediaLibrary.ts";
import { enforceStreamCacheQuota } from "../../utils/streamCache.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.mb !== "number" || !Number.isFinite(body.mb) || body.mb <= 0) {
    throw createError({ statusCode: 400, statusMessage: "mb is required and must be a positive number" });
  }

  const result = setStreamCacheMaxBytes(Math.round(body.mb * 1024 * 1024));
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  // Lowering the cap should shrink the cache immediately, not just on the
  // next write.
  enforceStreamCacheQuota();

  return result;
});
