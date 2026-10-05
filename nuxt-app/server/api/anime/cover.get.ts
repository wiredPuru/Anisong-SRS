import { readFileSync } from "node:fs";
import { resolveAnimeCover } from "../../utils/animeCoverStore.ts";

// `v` only busts the browser cache: the file is always the one the anime's own
// row names, so nothing in the query can reach the filesystem.
export default defineEventHandler((event) => {
  const id = Number(getQuery(event).id);
  const cover = Number.isInteger(id) ? resolveAnimeCover(id) : null;
  if (!cover) {
    throw createError({ statusCode: 404, statusMessage: "No cover for this anime" });
  }
  if (cover.kind === "remote") {
    return sendRedirect(event, cover.url, 302);
  }

  setHeader(event, "content-type", cover.mime);
  setHeader(event, "cache-control", "public, max-age=31536000, immutable");
  return readFileSync(cover.path);
});
