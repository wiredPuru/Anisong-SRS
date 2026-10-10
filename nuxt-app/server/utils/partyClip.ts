import { existsSync, statSync } from "node:fs";
import { createError, getQuery, type H3Event } from "h3";
import { assertClipUrlAllowed } from "./clipSourceGuard.ts";
import { isPathWithinLibrary } from "./mediaLibrary.ts";
import { findPartyItemByToken } from "./partyStore.ts";
import { getMimeType, serveRangedFile } from "./rangedFile.ts";
import { parseAllowedStreamUrl, resolveCachedPath } from "./streamCache.ts";

/** Serves the queued clip named by the request's `t` token, with byte ranges. */
export async function servePartyClip(event: H3Event) {
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
}
