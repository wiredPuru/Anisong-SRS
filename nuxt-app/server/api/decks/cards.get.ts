import { listCardsByAnime, listCardsByArtist, listCardsByManualDeck } from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel, getManualDeckLabel } from "../../utils/decks.ts";
import { PAGE_SIZE, parsePage } from "../../utils/pagination.ts";

export default defineEventHandler((event) => {
  const { type, id: idRaw, page: pageRaw, q } = getQuery(event);

  if (type !== "artist" && type !== "anime" && type !== "created") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'artist', 'anime', or 'created'" });
  }

  const id = Number(idRaw);
  if (typeof idRaw !== "string" || idRaw.trim() === "" || !Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  const requestedPage = parsePage(pageRaw);
  const query = typeof q === "string" ? q.trim() : undefined;

  if (type === "created") {
    const deckLabel = getManualDeckLabel(id);
    if (deckLabel === undefined) {
      throw createError({ statusCode: 404, statusMessage: "Deck not found" });
    }
    const first = listCardsByManualDeck(id, requestedPage, query);
    const totalPages = Math.max(Math.ceil(first.total / PAGE_SIZE), 1);
    const page = Math.min(requestedPage, totalPages);
    const result = page === requestedPage ? first : listCardsByManualDeck(id, page, query);
    return { deckLabel, cards: result.items, page, totalPages };
  }

  const deckLabel = type === "artist" ? getArtistLabel(id) : getAnimeLabel(id);
  if (deckLabel === undefined) {
    throw createError({
      statusCode: 404,
      statusMessage: type === "artist" ? "Artist not found" : "Anime not found",
    });
  }

  const list = type === "artist" ? listCardsByArtist : listCardsByAnime;
  const first = list(id, requestedPage, query);
  const totalPages = Math.max(Math.ceil(first.total / PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const result = page === requestedPage ? first : list(id, page, query);

  return { deckLabel, cards: result.items, page, totalPages };
});
