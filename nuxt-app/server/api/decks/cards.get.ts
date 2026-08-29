import { listCardsByAnime, listCardsByArtist, listCardsByManualDeck } from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel, getManualDeckLabel } from "../../utils/decks.ts";

export default defineEventHandler((event) => {
  const { type, id: idRaw } = getQuery(event);

  if (type !== "artist" && type !== "anime" && type !== "created") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'artist', 'anime', or 'created'" });
  }

  const id = Number(idRaw);
  if (typeof idRaw !== "string" || idRaw.trim() === "" || !Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  if (type === "created") {
    const deckLabel = getManualDeckLabel(id);
    if (deckLabel === undefined) {
      throw createError({ statusCode: 404, statusMessage: "Deck not found" });
    }
    return { deckLabel, cards: listCardsByManualDeck(id) };
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
