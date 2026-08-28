import { existsSync, statSync } from "node:fs";
import { isAbsolute, normalize, relative } from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { getLibraryPaths } from "./mediaLibrary.ts";

export interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: Date;
  createdAt: Date;
  songTitle: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
}

const cardSelection = {
  id: card.id,
  songId: card.songId,
  localVideoPath: card.localVideoPath,
  localAudioPath: card.localAudioPath,
  animethemesVideoUrl: card.animethemesVideoUrl,
  animethemesAudioUrl: card.animethemesAudioUrl,
  box: card.box,
  nextReviewAt: card.nextReviewAt,
  createdAt: card.createdAt,
  songTitle: song.title,
  themeSlot: song.themeSlot,
  artistName: artist.name,
  animeTitleEnglish: anime.titleEnglish,
  animeTitleRomaji: anime.titleRomaji,
};

function cardQuery() {
  return db
    .select(cardSelection)
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id));
}

export function listCards(): CardWithDetails[] {
  return cardQuery().orderBy(desc(card.createdAt)).all();
}

export function getCardWithDetails(id: number): CardWithDetails | undefined {
  return cardQuery().where(eq(card.id, id)).get();
}

export function listCardsByArtist(artistId: number): CardWithDetails[] {
  return cardQuery().where(eq(artist.id, artistId)).orderBy(desc(card.createdAt)).all();
}

export function listCardsByAnime(animeId: number): CardWithDetails[] {
  return cardQuery().where(eq(anime.id, animeId)).orderBy(desc(card.createdAt)).all();
}

function validateLocalPath(rawPath: string): { error: string } | { path: string } {
  const normalized = normalize(rawPath.trim());

  if (!isAbsolute(normalized)) {
    return { error: "Local path must be absolute." };
  }
  if (!existsSync(normalized)) {
    return { error: "Local file does not exist." };
  }
  if (!statSync(normalized).isFile()) {
    return { error: "Local path is not a file." };
  }

  const libraryPaths = getLibraryPaths();
  const withinLibrary = libraryPaths.some((libraryPath) => {
    const rel = relative(libraryPath, normalized);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
  if (!withinLibrary) {
    return { error: "Local file must be inside a configured media library folder." };
  }

  return { path: normalized };
}

function hasAnySource(sources: {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}): boolean {
  return Boolean(
    sources.localVideoPath || sources.localAudioPath || sources.animethemesVideoUrl || sources.animethemesAudioUrl,
  );
}

export interface CreateCardInput {
  songId: number;
  localVideoPath?: string | null;
  localAudioPath?: string | null;
  animethemesVideoUrl?: string | null;
  animethemesAudioUrl?: string | null;
}

export type CreateCardResult = { error: string } | { notFound: true } | { card: CardWithDetails };

export function createCard(input: CreateCardInput): CreateCardResult {
  const songRow = db.select().from(song).where(eq(song.id, input.songId)).get();
  if (!songRow) {
    return { notFound: true };
  }

  let localVideoPath: string | null = null;
  if (input.localVideoPath) {
    const result = validateLocalPath(input.localVideoPath);
    if ("error" in result) return result;
    localVideoPath = result.path;
  }

  let localAudioPath: string | null = null;
  if (input.localAudioPath) {
    const result = validateLocalPath(input.localAudioPath);
    if ("error" in result) return result;
    localAudioPath = result.path;
  }

  const animethemesVideoUrl = input.animethemesVideoUrl ?? null;
  const animethemesAudioUrl = input.animethemesAudioUrl ?? null;

  if (!hasAnySource({ localVideoPath, localAudioPath, animethemesVideoUrl, animethemesAudioUrl })) {
    return { error: "Card needs at least one video or audio source." };
  }

  const inserted = db
    .insert(card)
    .values({ songId: input.songId, localVideoPath, localAudioPath, animethemesVideoUrl, animethemesAudioUrl })
    .returning()
    .get();

  return { card: getCardWithDetails(inserted.id)! };
}

export interface UpdateCardInput {
  id: number;
  localVideoPath?: string | null;
  localAudioPath?: string | null;
}

export type UpdateCardResult = { error: string } | { notFound: true } | { card: CardWithDetails };

export function updateCard(input: UpdateCardInput): UpdateCardResult {
  const existing = db.select().from(card).where(eq(card.id, input.id)).get();
  if (!existing) {
    return { notFound: true };
  }

  const updates: { localVideoPath?: string | null; localAudioPath?: string | null } = {};

  if (input.localVideoPath !== undefined) {
    if (input.localVideoPath === null) {
      updates.localVideoPath = null;
    } else {
      const result = validateLocalPath(input.localVideoPath);
      if ("error" in result) return result;
      updates.localVideoPath = result.path;
    }
  }

  if (input.localAudioPath !== undefined) {
    if (input.localAudioPath === null) {
      updates.localAudioPath = null;
    } else {
      const result = validateLocalPath(input.localAudioPath);
      if ("error" in result) return result;
      updates.localAudioPath = result.path;
    }
  }

  const finalLocalVideo = "localVideoPath" in updates ? updates.localVideoPath! : existing.localVideoPath;
  const finalLocalAudio = "localAudioPath" in updates ? updates.localAudioPath! : existing.localAudioPath;

  if (
    !hasAnySource({
      localVideoPath: finalLocalVideo,
      localAudioPath: finalLocalAudio,
      animethemesVideoUrl: existing.animethemesVideoUrl,
      animethemesAudioUrl: existing.animethemesAudioUrl,
    })
  ) {
    return { error: "Card needs at least one video or audio source." };
  }

  if (Object.keys(updates).length > 0) {
    db.update(card).set(updates).where(eq(card.id, input.id)).run();
  }

  return { card: getCardWithDetails(input.id)! };
}

export function deleteCard(id: number): boolean {
  const result = db.delete(card).where(eq(card.id, id)).run();
  return result.changes > 0;
}
