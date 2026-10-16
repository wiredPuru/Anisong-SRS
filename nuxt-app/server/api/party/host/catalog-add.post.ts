import { addCatalogSongs } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { annSongIds?: unknown; position?: unknown } | null;
  const ids = body?.annSongIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw createError({ statusCode: 400, statusMessage: "annSongIds must hold 1-50 song ids" });
  }
  const position = body?.position ?? "end";
  if (position !== "next" && position !== "end") throw createError({ statusCode: 400, statusMessage: "position must be next or end" });
  return addCatalogSongs(ids as number[], position);
});
