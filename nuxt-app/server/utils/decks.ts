import { and, count, countDistinct, eq, like, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, deck, deckCard, song } from "../db/schema.ts";
import type { Paginated } from "./cards.ts";
import { PAGE_SIZE } from "./pagination.ts";

export interface ArtistDeck {
  id: number;
  name: string;
  cardCount: number;
}

export interface AnimeDeck {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  coverImageUrl: string | null;
  cardCount: number;
}

function artistSearchCondition(query?: string) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return like(artist.name, `%${trimmed}%`);
}

export function listArtistDecks(page: number, query?: string): Paginated<ArtistDeck> {
  const condition = artistSearchCondition(query);

  const totalBase = db
    .select({ count: countDistinct(artist.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id));
  const total = (condition ? totalBase.where(condition) : totalBase).get()!.count;

  const itemsBase = db
    .select({ id: artist.id, name: artist.name, cardCount: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id));
  const items = (condition ? itemsBase.where(condition) : itemsBase)
    .groupBy(artist.id)
    .orderBy(artist.name)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

function animeSearchCondition(query?: string) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  const pattern = `%${trimmed}%`;
  return or(like(anime.titleEnglish, pattern), like(anime.titleRomaji, pattern), like(anime.titleNative, pattern));
}

export function listAnimeDecks(page: number, query?: string): Paginated<AnimeDeck> {
  const condition = animeSearchCondition(query);

  const totalBase = db
    .select({ count: countDistinct(anime.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id));
  const total = (condition ? totalBase.where(condition) : totalBase).get()!.count;

  const itemsBase = db
    .select({
      id: anime.id,
      titleEnglish: anime.titleEnglish,
      titleRomaji: anime.titleRomaji,
      coverImageUrl: anime.coverImageUrl,
      cardCount: count(card.id),
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id));
  const items = (condition ? itemsBase.where(condition) : itemsBase)
    .groupBy(anime.id)
    .orderBy(anime.titleEnglish)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

export function getArtistLabel(id: number): string | undefined {
  return db.select({ name: artist.name }).from(artist).where(eq(artist.id, id)).get()?.name;
}

export function getAnimeLabel(id: number): string | undefined {
  return db.select({ titleEnglish: anime.titleEnglish }).from(anime).where(eq(anime.id, id)).get()?.titleEnglish;
}

export interface ManualDeck {
  id: number;
  name: string;
  createdAt: Date;
  cardCount: number;
}

function manualDeckSearchCondition(query?: string) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return like(deck.name, `%${trimmed}%`);
}

export function listManualDecks(page: number, query?: string): Paginated<ManualDeck> {
  const condition = manualDeckSearchCondition(query);

  const totalBase = db.select({ count: count(deck.id) }).from(deck);
  const total = (condition ? totalBase.where(condition) : totalBase).get()!.count;

  const itemsBase = db
    .select({ id: deck.id, name: deck.name, createdAt: deck.createdAt, cardCount: count(deckCard.id) })
    .from(deck)
    .leftJoin(deckCard, eq(deck.id, deckCard.deckId));
  const items = (condition ? itemsBase.where(condition) : itemsBase)
    .groupBy(deck.id)
    .orderBy(deck.name)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

export function getManualDeckLabel(id: number): string | undefined {
  return db.select({ name: deck.name }).from(deck).where(eq(deck.id, id)).get()?.name;
}

function nameExists(name: string, excludeId?: number): boolean {
  const existing = db.select({ id: deck.id }).from(deck).where(eq(deck.name, name)).get();
  return existing !== undefined && existing.id !== excludeId;
}

function countCardsInDeck(deckId: number): number {
  return db.select({ count: count(deckCard.id) }).from(deckCard).where(eq(deckCard.deckId, deckId)).get()!.count;
}

export type ManualDeckResult = { error: string } | { notFound: true } | { deck: ManualDeck };

export function createManualDeck(rawName: string): ManualDeckResult {
  const name = rawName.trim();
  if (!name) {
    return { error: "Deck name is required." };
  }
  if (nameExists(name)) {
    return { error: "A deck with this name already exists." };
  }

  const inserted = db.insert(deck).values({ name }).returning().get();
  return { deck: { ...inserted, cardCount: countCardsInDeck(inserted.id) } };
}

export function renameManualDeck(id: number, rawName: string): ManualDeckResult {
  const existing = db.select().from(deck).where(eq(deck.id, id)).get();
  if (!existing) {
    return { notFound: true };
  }

  const name = rawName.trim();
  if (!name) {
    return { error: "Deck name is required." };
  }
  if (nameExists(name, id)) {
    return { error: "A deck with this name already exists." };
  }

  const updated = db.update(deck).set({ name }).where(eq(deck.id, id)).returning().get();
  return { deck: { ...updated, cardCount: countCardsInDeck(id) } };
}

export function deleteManualDeck(id: number): boolean {
  const result = db.delete(deck).where(eq(deck.id, id)).run();
  return result.changes > 0;
}

export function getDeckMembershipsByCard(): Record<number, number[]> {
  const rows = db.select({ cardId: deckCard.cardId, deckId: deckCard.deckId }).from(deckCard).all();
  const result: Record<number, number[]> = {};
  for (const row of rows) {
    (result[row.cardId] ??= []).push(row.deckId);
  }
  return result;
}

export type DeckCardMembershipResult = { notFound: true } | { success: true };

export function addCardToDeck(deckId: number, cardId: number): DeckCardMembershipResult {
  const deckExists = db.select({ id: deck.id }).from(deck).where(eq(deck.id, deckId)).get();
  const cardExists = db.select({ id: card.id }).from(card).where(eq(card.id, cardId)).get();
  if (!deckExists || !cardExists) {
    return { notFound: true };
  }

  db.insert(deckCard).values({ deckId, cardId }).onConflictDoNothing().run();
  return { success: true };
}

export function removeCardFromDeck(deckId: number, cardId: number): DeckCardMembershipResult {
  const deckExists = db.select({ id: deck.id }).from(deck).where(eq(deck.id, deckId)).get();
  if (!deckExists) {
    return { notFound: true };
  }

  db.delete(deckCard).where(and(eq(deckCard.deckId, deckId), eq(deckCard.cardId, cardId))).run();
  return { success: true };
}
