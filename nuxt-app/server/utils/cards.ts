import { existsSync, statSync, unlinkSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import { and, asc, desc, eq, lte, ne, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, deckCard, song } from "../db/schema.ts";
import { isPathWithinLibrary } from "./mediaLibrary.ts";
import { getOrCreateArtist } from "./lookup.ts";

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
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
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
  animeTitleNative: anime.titleNative,
  animeCoverImageUrl: anime.coverImageUrl,
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

export function cardExistsForSong(songId: number): boolean {
  return db.select({ id: card.id }).from(card).where(eq(card.songId, songId)).get() !== undefined;
}

export function listCardsByArtist(artistId: number): CardWithDetails[] {
  return cardQuery().where(eq(artist.id, artistId)).orderBy(desc(card.createdAt)).all();
}

export function listCardsByAnime(animeId: number): CardWithDetails[] {
  return cardQuery().where(eq(anime.id, animeId)).orderBy(desc(card.createdAt)).all();
}

export function listCardsByManualDeck(deckId: number): CardWithDetails[] {
  return cardQuery()
    .innerJoin(deckCard, eq(card.id, deckCard.cardId))
    .where(eq(deckCard.deckId, deckId))
    .orderBy(desc(card.createdAt))
    .all();
}

export type StudyScope = { type: "all" } | { type: "artist"; id: number } | { type: "anime"; id: number };

export function getNextDueCard(scope: StudyScope): CardWithDetails | undefined {
  const dueCondition = lte(card.nextReviewAt, new Date());
  const scopeCondition =
    scope.type === "artist" ? eq(artist.id, scope.id) : scope.type === "anime" ? eq(anime.id, scope.id) : undefined;

  return cardQuery()
    .where(scopeCondition ? and(dueCondition, scopeCondition) : dueCondition)
    .orderBy(asc(card.nextReviewAt))
    .get();
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

  if (!isPathWithinLibrary(normalized)) {
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
  songTitle?: string;
  themeSlot?: string;
  artistMode?: "rename" | "reassign";
  artistName?: string;
}

export type UpdateCardResult = { error: string } | { notFound: true } | { card: CardWithDetails };

export function updateCard(input: UpdateCardInput): UpdateCardResult {
  const existing = db.select().from(card).where(eq(card.id, input.id)).get();
  if (!existing) {
    return { notFound: true };
  }

  const songRow = db.select().from(song).where(eq(song.id, existing.songId)).get()!;

  const songUpdates: { title?: string; themeSlot?: string } = {};

  if (input.songTitle !== undefined) {
    const trimmed = input.songTitle.trim();
    if (trimmed === "") {
      return { error: "Song title cannot be empty." };
    }
    songUpdates.title = trimmed;
  }

  if (input.themeSlot !== undefined) {
    const trimmed = input.themeSlot.trim();
    if (trimmed === "") {
      return { error: "Theme slot cannot be empty." };
    }
    if (trimmed !== songRow.themeSlot) {
      const collision = db
        .select({ id: song.id })
        .from(song)
        .where(and(eq(song.animeId, songRow.animeId), eq(song.themeSlot, trimmed), ne(song.id, songRow.id)))
        .get();
      if (collision) {
        return { error: "Another song on this anime already uses that theme slot." };
      }
    }
    songUpdates.themeSlot = trimmed;
  }

  if (input.artistMode !== undefined) {
    const trimmedName = (input.artistName ?? "").trim();
    if (trimmedName === "") {
      return { error: "Artist name cannot be empty." };
    }

    if (input.artistMode === "rename") {
      const collision = db
        .select({ id: artist.id })
        .from(artist)
        .where(and(eq(artist.name, trimmedName), ne(artist.id, songRow.artistId)))
        .get();
      if (collision) {
        return { error: "Another artist already has that name - use the reassign mode instead." };
      }
      db.update(artist).set({ name: trimmedName }).where(eq(artist.id, songRow.artistId)).run();
    } else {
      const targetArtist = getOrCreateArtist(trimmedName);
      db.update(song).set({ artistId: targetArtist.id }).where(eq(song.id, songRow.id)).run();
    }
  }

  if (Object.keys(songUpdates).length > 0) {
    db.update(song).set(songUpdates).where(eq(song.id, songRow.id)).run();
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

function deleteFileIfUnreferenced(path: string): void {
  const stillReferenced = db
    .select({ id: card.id })
    .from(card)
    .where(or(eq(card.localVideoPath, path), eq(card.localAudioPath, path)))
    .get();
  if (stillReferenced) return;

  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // Best-effort cleanup - a permission error or a file that vanished
    // underneath us just means it stays behind, same as before this feature.
  }
}

export function deleteCard(id: number): boolean {
  const existing = db.select().from(card).where(eq(card.id, id)).get();
  if (!existing) {
    return false;
  }

  const localPaths = [existing.localVideoPath, existing.localAudioPath].filter(
    (path): path is string => path !== null,
  );

  db.delete(card).where(eq(card.id, id)).run();

  for (const path of localPaths) {
    deleteFileIfUnreferenced(path);
  }

  return true;
}
