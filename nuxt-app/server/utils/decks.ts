import { and, count, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, deck, deckCard, song } from "../db/schema.ts";

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
      coverImageUrl: anime.coverImageUrl,
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

export interface ManualDeck {
  id: number;
  name: string;
  createdAt: Date;
  cardCount: number;
}

export function listManualDecks(): ManualDeck[] {
  return db
    .select({ id: deck.id, name: deck.name, createdAt: deck.createdAt, cardCount: count(deckCard.id) })
    .from(deck)
    .leftJoin(deckCard, eq(deck.id, deckCard.deckId))
    .groupBy(deck.id)
    .orderBy(deck.name)
    .all();
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
