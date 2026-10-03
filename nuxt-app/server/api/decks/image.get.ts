import { readFileSync } from "node:fs";
import { getDeckImageFile } from "../../utils/deckImageStore.ts";

// `v` is only a cache-buster in the URL: the file is always the one the deck's
// own row names, so nothing in the query can reach the filesystem.
export default defineEventHandler((event) => {
  const id = Number(getQuery(event).id);
  const image = Number.isInteger(id) ? getDeckImageFile(id) : null;
  if (!image) {
    throw createError({ statusCode: 404, statusMessage: "No picture for this deck" });
  }

  setHeader(event, "content-type", image.mime);
  setHeader(event, "cache-control", "public, max-age=31536000, immutable");
  return readFileSync(image.path);
});
