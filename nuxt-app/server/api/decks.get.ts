import { listAnimeDecks, listArtistDecks, listManualDecks } from "../utils/decks.ts";
import { PAGE_SIZE, parsePage } from "../utils/pagination.ts";

export default defineEventHandler((event) => {
  const { type, page: pageRaw, q } = getQuery(event);

  if (type !== "artist" && type !== "anime" && type !== "created") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'artist', 'anime', or 'created'" });
  }

  const query = typeof q === "string" ? q.trim() : undefined;
  const list = type === "artist" ? listArtistDecks : type === "anime" ? listAnimeDecks : listManualDecks;

  const requestedPage = parsePage(pageRaw);
  const first = list(requestedPage, query);
  const totalPages = Math.max(Math.ceil(first.total / PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);

  const result = page === requestedPage ? first : list(page, query);

  return { decks: result.items, page, totalPages };
});
