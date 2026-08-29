import { exportDeck } from "../../utils/deckExport.ts";
import type { DeckExportScope } from "../../utils/deckExport.ts";
import { getAnimeLabel, getArtistLabel } from "../../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const scopeType = body?.scope?.type;
  if (scopeType !== "artist" && scopeType !== "anime") {
    throw createError({ statusCode: 400, statusMessage: "scope.type must be 'artist' or 'anime'" });
  }
  if (typeof body.scope.id !== "number") {
    throw createError({ statusCode: 400, statusMessage: "scope.id is required and must be a number" });
  }
  if (typeof body.destPath !== "string" || !body.destPath.trim()) {
    throw createError({ statusCode: 400, statusMessage: "destPath is required" });
  }

  const scope = body.scope as DeckExportScope;
  const includeAudio = Boolean(body.includeAudio);

  const deckLabel = scope.type === "artist" ? getArtistLabel(scope.id) : getAnimeLabel(scope.id);
  if (deckLabel === undefined) {
    throw createError({
      statusCode: 404,
      statusMessage: scope.type === "artist" ? "Artist not found" : "Anime not found",
    });
  }

  const result = exportDeck(scope, body.destPath, includeAudio);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
