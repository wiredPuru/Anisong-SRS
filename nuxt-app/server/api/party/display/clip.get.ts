import { existsSync, statSync } from "node:fs";
import { assertClipUrlAllowed } from "../../../utils/clipSourceGuard.ts";
import { isPathWithinLibrary } from "../../../utils/mediaLibrary.ts";
import { findPartyItemByToken } from "../../../utils/partyStore.ts";
import { getMimeType, serveRangedFile } from "../../../utils/rangedFile.ts";
import { parseAllowedStreamUrl, resolveCachedPath } from "../../../utils/streamCache.ts";

// The display only ever knows a token, so neither a file name nor a clip URL
// (both of which can name the anime) reaches the screen being guessed at.
export default defineEventHandler(async (event) => {
  const token = getQuery(event).t;
  const item = typeof token === "string" ? findPartyItemByToken(token) : null;
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: "Clip not found" });
  }

  const { source } = item.clip;
  if (source.type === "local") {
    if (!existsSync(source.path) || !statSync(source.path).isFile() || !isPathWithinLibrary(source.path)) {
      throw createError({ statusCode: 404, statusMessage: "Clip file not found" });
    }
    return serveRangedFile(event, source.path, getMimeType(source.path));
  }

  const parsed = parseAllowedStreamUrl(source.url);
  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: "Clip not found" });
  }
  assertClipUrlAllowed(source.url);
  const cached = await resolveCachedPath(source.url);
  if ("error" in cached) {
    throw createError({ statusCode: 502, statusMessage: "The clip could not be loaded" });
  }
  return serveRangedFile(event, cached.path, getMimeType(parsed.pathname));
});
