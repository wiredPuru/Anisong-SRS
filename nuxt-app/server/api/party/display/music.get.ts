import { getLibraryPaths } from "../../../utils/mediaLibrary.ts";
import { listPartyMusic } from "../../../utils/partyMusic.ts";
import { getMimeType, serveRangedFile } from "../../../utils/rangedFile.ts";

// Without ?i, how many tracks there are; with it, that track by index, so the
// display never builds a file path itself.
export default defineEventHandler((event) => {
  const { files } = listPartyMusic(getLibraryPaths());
  const raw = getQuery(event).i;
  if (raw === undefined) return { count: files.length };

  const index = Number(raw);
  const file = Number.isInteger(index) ? files[index] : undefined;
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: "Track not found" });
  }
  return serveRangedFile(event, file.path, getMimeType(file.name));
});
