import { join } from "node:path";
import { listPartyMusic } from "../../../utils/partyMusic.ts";
import { getMimeType, serveRangedFile } from "../../../utils/rangedFile.ts";

// Without ?i, how many tracks there are; with it, that track by index, so the
// display never builds a file path itself.
export default defineEventHandler((event) => {
  const { folder, tracks } = listPartyMusic();
  const raw = getQuery(event).i;
  if (raw === undefined) return { count: tracks.length };

  const index = Number(raw);
  const name = Number.isInteger(index) ? tracks[index] : undefined;
  if (!name) {
    throw createError({ statusCode: 404, statusMessage: "Track not found" });
  }
  return serveRangedFile(event, join(folder, name), getMimeType(name));
});
