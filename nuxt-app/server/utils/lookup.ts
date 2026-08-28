import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, song } from "../db/schema.ts";
import type { Anime, Artist, Song } from "../db/schema.ts";

export function upsertAnime(data: {
  aniListId: number;
  animethemesId: number | null;
  titleEnglish: string | null;
  titleRomaji: string;
  titleNative: string | null;
}): Anime {
  const values = {
    aniListId: data.aniListId,
    animethemesId: data.animethemesId,
    titleEnglish: data.titleEnglish ?? data.titleRomaji,
    titleRomaji: data.titleRomaji,
    titleNative: data.titleNative ?? data.titleRomaji,
  };

  return db
    .insert(anime)
    .values(values)
    .onConflictDoUpdate({ target: anime.aniListId, set: values })
    .returning()
    .get();
}

export function getOrCreateArtist(name: string): Artist {
  const existing = db.select().from(artist).where(eq(artist.name, name)).get();
  if (existing) {
    return existing;
  }

  return db.insert(artist).values({ name }).returning().get();
}

export function upsertSong(data: {
  animeId: number;
  artistId: number;
  title: string;
  themeSlot: string;
  animethemesThemeId: number | null;
}): Song {
  return db
    .insert(song)
    .values(data)
    .onConflictDoUpdate({
      target: [song.animeId, song.themeSlot],
      set: {
        artistId: data.artistId,
        title: data.title,
        animethemesThemeId: data.animethemesThemeId,
      },
    })
    .returning()
    .get();
}
