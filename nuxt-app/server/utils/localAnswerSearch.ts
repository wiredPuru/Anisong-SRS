import { eq, like, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { toArtistAnswerOptions, type ArtistAnswerOption } from "./artistAnswerOptions.ts";
import { toSongAnswerOptions, type SongAnswerOption } from "./songAnswerOptions.ts";

export interface LocalAnimeAnswerOption {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

export type LocalAnswerKind = "anime" | "artist" | "song";

const FETCH_LIMIT = 40;

export function isLocalAnswerKind(value: unknown): value is LocalAnswerKind {
  return value === "anime" || value === "artist" || value === "song";
}

// Offline typed answers: the same redacted shapes as the online routes, drawn
// only from titles the library already holds cards for.
export function searchLocalAnimeAnswers(q: string): LocalAnimeAnswerOption[] {
  const pattern = `%${q}%`;
  return db
    .selectDistinct({
      aniListId: anime.aniListId,
      titleRomaji: anime.titleRomaji,
      titleEnglish: anime.titleEnglish,
      titleNative: anime.titleNative,
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(or(like(anime.titleRomaji, pattern), like(anime.titleEnglish, pattern), like(anime.titleNative, pattern)))
    .limit(10)
    .all();
}

export function searchLocalArtistAnswers(q: string): ArtistAnswerOption[] {
  const rows = db
    .selectDistinct({ name: artist.name })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .where(like(artist.name, `%${q}%`))
    .limit(FETCH_LIMIT)
    .all();
  return toArtistAnswerOptions(rows);
}

export function searchLocalSongAnswers(q: string): SongAnswerOption[] {
  const pattern = `%${q}%`;
  const rows = db
    .selectDistinct({ songTitle: song.title, artistName: artist.name })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .where(or(like(song.title, pattern), like(song.titleNative, pattern)))
    .limit(FETCH_LIMIT)
    .all();
  return toSongAnswerOptions(rows);
}

export function searchLocalAnswers(kind: LocalAnswerKind, q: string) {
  if (kind === "anime") return searchLocalAnimeAnswers(q);
  if (kind === "artist") return searchLocalArtistAnswers(q);
  return searchLocalSongAnswers(q);
}
