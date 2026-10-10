import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../db/client.ts";
import { anime, artist, card, song } from "../../../db/schema.ts";
import { scopeFilter, type StudyScope } from "../../../utils/cards.ts";

const TYPES = new Set(["artist", "anime", "created"]);

// The songs inside one anime, artist or deck, so the host can pick a single one.
export default defineEventHandler((event) => {
  const { type, id } = getQuery(event);
  const numericId = Number(id);
  if (typeof type !== "string" || !TYPES.has(type) || !Number.isInteger(numericId) || numericId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "type and id are required" });
  }
  const scope = { type, id: numericId } as StudyScope;
  const rows = db
    .select({
      cardId: card.id,
      animeTitle: anime.titleEnglish,
      songTitle: song.title,
      artistName: artist.name,
      themeSlot: song.themeSlot,
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(scopeFilter(scope)))
    .orderBy(asc(anime.titleRomaji), asc(song.themeSlot))
    .limit(200)
    .all();
  return { results: rows };
});
