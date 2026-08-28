import { listAnimeDecks, listArtistDecks } from "../utils/decks.ts";

export default defineEventHandler((event) => {
  const { type } = getQuery(event);

  if (type === "artist") {
    return { decks: listArtistDecks() };
  }
  if (type === "anime") {
    return { decks: listAnimeDecks() };
  }

  throw createError({ statusCode: 400, statusMessage: "type must be 'artist' or 'anime'" });
});
