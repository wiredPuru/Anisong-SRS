import { listAnimeDecks, listArtistDecks, listManualDecks } from "../utils/decks.ts";

export default defineEventHandler((event) => {
  const { type } = getQuery(event);

  if (type === "artist") {
    return { decks: listArtistDecks() };
  }
  if (type === "anime") {
    return { decks: listAnimeDecks() };
  }
  if (type === "created") {
    return { decks: listManualDecks() };
  }

  throw createError({ statusCode: 400, statusMessage: "type must be 'artist', 'anime', or 'created'" });
});
