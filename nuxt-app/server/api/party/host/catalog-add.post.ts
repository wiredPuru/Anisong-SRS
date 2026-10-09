import { addCatalogSongs } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { annSongIds?: unknown } | null;
  const ids = body?.annSongIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw createError({ statusCode: 400, statusMessage: "annSongIds must hold 1-50 song ids" });
  }
  return { loaded: addCatalogSongs(ids as number[]) };
});
