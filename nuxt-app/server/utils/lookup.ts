import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, song } from "../db/schema.ts";
import type { Anime, Artist, Song } from "../db/schema.ts";

// Read-only lookups by natural key, for callers (deck import) that must not
// clobber existing metadata with stale bundled values - see upsertAnime/
// upsertSong below, which do overwrite on conflict and are for callers with
// fresh authoritative data (live AniList/animethemes.moe lookups).
export function findAnimeByAniListId(aniListId: number): Anime | undefined {
  return db.select().from(anime).where(eq(anime.aniListId, aniListId)).get();
}

export function findSongByAnimeAndSlot(animeId: number, themeSlot: string): Song | undefined {
  return db
    .select()
    .from(song)
    .where(and(eq(song.animeId, animeId), eq(song.themeSlot, themeSlot)))
    .get();
}

export function getArtistById(id: number): Artist | undefined {
  return db.select().from(artist).where(eq(artist.id, id)).get();
}

export function upsertAnime(data: {
  aniListId: number;
  animethemesId: number | null;
  titleEnglish: string | null;
  titleRomaji: string;
  titleNative: string | null;
  // Omitted (not null) means "leave the stored cover art alone" - callers that don't
  // have fresh AniList data (e.g. deck import) must not clobber an existing cover.
  coverImageUrl?: string | null;
}): Anime {
  const values: typeof anime.$inferInsert = {
    aniListId: data.aniListId,
    animethemesId: data.animethemesId,
    titleEnglish: data.titleEnglish ?? data.titleRomaji,
    titleRomaji: data.titleRomaji,
    titleNative: data.titleNative ?? data.titleRomaji,
  };
  const set: Partial<typeof values> = { ...values };
  // Sparse provider metadata supplies defaults on insert, but cannot erase
  // richer titles or the external mapping on an existing row.
  if (data.titleEnglish === null) delete set.titleEnglish;
  if (data.titleNative === null) delete set.titleNative;
  if (data.animethemesId === null) delete set.animethemesId;
  if (data.coverImageUrl !== undefined) {
    values.coverImageUrl = data.coverImageUrl;
    set.coverImageUrl = data.coverImageUrl;
  }

  return db.insert(anime).values(values).onConflictDoUpdate({ target: anime.aniListId, set }).returning().get();
}

// Fills in only the cover column, for a row inserted without one. An AniList
// outage falls back to AnimeThemes metadata, which carries no cover art at all
// (see METADATA_FIELDS in lib/animethemes.ts), and nothing re-resolves an anime
// once it exists - so those rows stay coverless until something backfills them.
// Deliberately not upsertAnime: that wants a full title set, and this caller
// has no fresh copy of the titles to supply.
export function setAnimeCoverImage(animeId: number, coverImageUrl: string): void {
  db.update(anime).set({ coverImageUrl }).where(eq(anime.id, animeId)).run();
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
  titleNative?: string | null;
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
        titleNative: data.titleNative,
        animethemesThemeId: data.animethemesThemeId,
      },
    })
    .returning()
    .get();
}
