import { count, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";

export interface ArtistDeck {
  id: number;
  name: string;
  cardCount: number;
}

export interface AnimeDeck {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  cardCount: number;
}

export function listArtistDecks(): ArtistDeck[] {
  return db
    .select({ id: artist.id, name: artist.name, cardCount: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .groupBy(artist.id)
    .orderBy(artist.name)
    .all();
}

export function listAnimeDecks(): AnimeDeck[] {
  return db
    .select({
      id: anime.id,
      titleEnglish: anime.titleEnglish,
      titleRomaji: anime.titleRomaji,
      cardCount: count(card.id),
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .groupBy(anime.id)
    .orderBy(anime.titleEnglish)
    .all();
}

export function getArtistLabel(id: number): string | undefined {
  return db.select({ name: artist.name }).from(artist).where(eq(artist.id, id)).get()?.name;
}

export function getAnimeLabel(id: number): string | undefined {
  return db.select({ titleEnglish: anime.titleEnglish }).from(anime).where(eq(anime.id, id)).get()?.titleEnglish;
}
