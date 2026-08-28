import { listCardsByAnime, listCardsByArtist } from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel } from "../../utils/decks.ts";

export default defineEventHandler((event) => {
  const { type, id: idRaw } = getQuery(event);

  if (type !== "artist" && type !== "anime") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'artist' or 'anime'" });
  }

  const id = Number(idRaw);
  if (typeof idRaw !== "string" || idRaw.trim() === "" || !Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  const deckLabel = type === "artist" ? getArtistLabel(id) : getAnimeLabel(id);
  if (deckLabel === undefined) {
    throw createError({
      statusCode: 404,
      statusMessage: type === "artist" ? "Artist not found" : "Anime not found",
    });
  }

  const cards = type === "artist" ? listCardsByArtist(id) : listCardsByAnime(id);
  return { deckLabel, cards };
});
