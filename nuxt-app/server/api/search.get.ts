import { searchCards } from "../utils/cards.ts";
import { searchAnime, searchArtists, searchManualDecks } from "../utils/decks.ts";

export default defineEventHandler((event) => {
  const { q } = getQuery(event);
  const query = typeof q === "string" ? q.trim() : "";

  if (query.length < 2) {
    return { cards: [], artists: [], anime: [], decks: [] };
  }

  return {
    cards: searchCards(query),
    artists: searchArtists(query),
    anime: searchAnime(query),
    decks: searchManualDecks(query),
  };
});
