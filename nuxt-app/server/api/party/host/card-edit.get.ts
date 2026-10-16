import { eq } from "drizzle-orm";
import { db } from "../../../db/client.ts";
import { artist, card, song } from "../../../db/schema.ts";

// What the queue's Edit card modal starts from.
export default defineEventHandler((event) => {
  const cardId = Number(getQuery(event).cardId);
  if (!Number.isInteger(cardId) || cardId <= 0) throw createError({ statusCode: 400, statusMessage: "cardId must be a positive integer" });
  const row = db
    .select({ songTitle: song.title, themeSlot: song.themeSlot, artistName: artist.name, notes: card.notes })
    .from(card)
    .innerJoin(song, eq(song.id, card.songId))
    .innerJoin(artist, eq(artist.id, song.artistId))
    .where(eq(card.id, cardId))
    .get();
  if (!row) throw createError({ statusCode: 404, statusMessage: "That song is not a card in your library" });
  return { cardId, ...row };
});
