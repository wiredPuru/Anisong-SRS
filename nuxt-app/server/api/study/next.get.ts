import type { StudyScope } from "../../utils/cards.ts";
import { getNextDueCard } from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel } from "../../utils/decks.ts";

export default defineEventHandler((event) => {
  const { type, id: idRaw } = getQuery(event);

  if (type !== "all" && type !== "artist" && type !== "anime") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'all', 'artist', or 'anime'" });
  }

  let scope: StudyScope;

  if (type === "all") {
    scope = { type: "all" };
  } else {
    const id = Number(idRaw);
    if (typeof idRaw !== "string" || idRaw.trim() === "" || !Number.isFinite(id)) {
      throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
    }

    const label = type === "artist" ? getArtistLabel(id) : getAnimeLabel(id);
    if (label === undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: type === "artist" ? "Artist not found" : "Anime not found",
      });
    }

    scope = type === "artist" ? { type: "artist", id } : { type: "anime", id };
  }

  return { card: getNextDueCard(scope) ?? null };
});
