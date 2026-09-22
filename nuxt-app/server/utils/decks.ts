import { and, count, countDistinct, eq, inArray, like, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, deck, deckCard, reviewLog, song } from "../db/schema.ts";
import { baseDueCondition, type Paginated, type StudyScope } from "./cards.ts";
import { DEFAULT_GRADING_CRITERION, type GradingCriterion } from "./gradingCriterion.ts";
import { PAGE_SIZE } from "./pagination.ts";
import { deriveCounts, passCountExpr, titleReviewsOfCard } from "./stats.ts";

export interface ArtistDeck {
  id: number;
  name: string;
  cardCount: number;
  passRate: number | null;
  dueCount: number;
}

export interface AnimeDeck {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  coverImageUrl: string | null;
  cardCount: number;
  passRate: number | null;
  dueCount: number;
}

// Scoped to just the ids on the current page rather than every artist/anime
// with a card, and computed as a separate grouped query merged by id instead
// of joined into the cardCount query directly, which would fan out cardCount
// across each matching reviewLog row.
function passRatesByArtist(ids: number[]): Map<number, number | null> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: artist.id, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .leftJoin(reviewLog, titleReviewsOfCard())
    .where(inArray(artist.id, ids))
    .groupBy(artist.id)
    .all();
  return new Map(rows.map((r) => [r.id, deriveCounts(r.totalReviews, r.passCount).passRate]));
}

function passRatesByAnime(ids: number[]): Map<number, number | null> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: anime.id, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .leftJoin(reviewLog, titleReviewsOfCard())
    .where(inArray(anime.id, ids))
    .groupBy(anime.id)
    .all();
  return new Map(rows.map((r) => [r.id, deriveCounts(r.totalReviews, r.passCount).passRate]));
}

// Manual decks have no existing stats query to reuse (they aren't grouped by
// artist/anime), so this joins through deckCard instead - same grouped shape
// otherwise.
function passRatesByManualDeck(ids: number[]): Map<number, number | null> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: deck.id, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(deckCard)
    .innerJoin(deck, eq(deckCard.deckId, deck.id))
    .innerJoin(card, eq(deckCard.cardId, card.id))
    .leftJoin(reviewLog, titleReviewsOfCard())
    .where(inArray(deck.id, ids))
    .groupBy(deck.id)
    .all();
  return new Map(rows.map((r) => [r.id, deriveCounts(r.totalReviews, r.passCount).passRate]));
}

// Reuses cards.ts's shared due/new-card-limit condition (feature 40), grouped
// by artist/anime id in one query rather than called once per deck - the
// daily-new-card-limit lookup inside it should only run once per request.
function dueCountsByArtist(ids: number[]): Map<number, number> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: artist.id, dueCount: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .where(and(baseDueCondition(), inArray(artist.id, ids)))
    .groupBy(artist.id)
    .all();
  return new Map(rows.map((r) => [r.id, r.dueCount]));
}

function dueCountsByAnime(ids: number[]): Map<number, number> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: anime.id, dueCount: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(baseDueCondition(), inArray(anime.id, ids)))
    .groupBy(anime.id)
    .all();
  return new Map(rows.map((r) => [r.id, r.dueCount]));
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

  const ids = items.map((item) => item.id);
  const passRates = passRatesByArtist(ids);
  const dueCounts = dueCountsByArtist(ids);
  return {
    items: items.map((item) => ({
      ...item,
      passRate: passRates.get(item.id) ?? null,
      dueCount: dueCounts.get(item.id) ?? 0,
    })),
    total,
  };
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

  const ids = items.map((item) => item.id);
  const passRates = passRatesByAnime(ids);
  const dueCounts = dueCountsByAnime(ids);
  return {
    items: items.map((item) => ({
      ...item,
      passRate: passRates.get(item.id) ?? null,
      dueCount: dueCounts.get(item.id) ?? 0,
    })),
    total,
  };
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
  gradingCriterion: GradingCriterion;
  cardCount: number;
  passRate: number | null;
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
    .select({
      id: deck.id,
      name: deck.name,
      createdAt: deck.createdAt,
      gradingCriterion: deck.gradingCriterion,
      cardCount: count(deckCard.id),
    })
    .from(deck)
    .leftJoin(deckCard, eq(deck.id, deckCard.deckId));
  const items = (condition ? itemsBase.where(condition) : itemsBase)
    .groupBy(deck.id)
    .orderBy(deck.name)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  const passRates = passRatesByManualDeck(items.map((item) => item.id));
  return {
    items: items.map((item) => ({ ...item, passRate: passRates.get(item.id) ?? null })),
    total,
  };
}

// Only a manual deck stores a criterion. Artist and anime decks are
// query-time groupings (feature 5) with no row to hold a setting, and "all" is
// not a deck at all, so those three return before the lookup runs.
export function resolveScopeCriterion(scope: StudyScope): GradingCriterion {
  if (scope.type !== "created") return DEFAULT_GRADING_CRITERION;
  const row = db.select({ criterion: deck.gradingCriterion }).from(deck).where(eq(deck.id, scope.id)).get();
  // A deck that no longer exists is the caller's 404 to report, not ours to
  // guess at: fall back to the default rather than throwing from a resolver.
  return row?.criterion ?? DEFAULT_GRADING_CRITERION;
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
  return { deck: { ...inserted, cardCount: countCardsInDeck(inserted.id), passRate: null } };
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
  return { deck: { ...updated, cardCount: countCardsInDeck(id), passRate: passRatesByManualDeck([id]).get(id) ?? null } };
}

export function setManualDeckCriterion(id: number, criterion: GradingCriterion): ManualDeckResult {
  const updated = db.update(deck).set({ gradingCriterion: criterion }).where(eq(deck.id, id)).returning().get();
  if (!updated) {
    return { notFound: true };
  }
  return { deck: { ...updated, cardCount: countCardsInDeck(id), passRate: passRatesByManualDeck([id]).get(id) ?? null } };
}

export function getManualDeckCriterion(id: number): GradingCriterion | undefined {
  return db.select({ criterion: deck.gradingCriterion }).from(deck).where(eq(deck.id, id)).get()?.criterion;
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

export type BulkDeckAddResult = { notFound: true } | { added: number[]; notFound: number[] };

/** Adds many cards to one deck. Already-member cards are counted as added, since the insert is idempotent. */
export function addCardsToDeck(deckId: number, cardIds: readonly number[]): BulkDeckAddResult {
  const deckExists = db.select({ id: deck.id }).from(deck).where(eq(deck.id, deckId)).get();
  if (!deckExists) {
    return { notFound: true };
  }

  const existing = db
    .select({ id: card.id })
    .from(card)
    .where(inArray(card.id, [...cardIds]))
    .all();
  const added = existing.map((row) => row.id);
  const present = new Set(added);

  if (added.length) {
    db.insert(deckCard)
      .values(added.map((cardId) => ({ deckId, cardId })))
      .onConflictDoNothing()
      .run();
  }

  return { added, notFound: cardIds.filter((id) => !present.has(id)) };
}

export function removeCardFromDeck(deckId: number, cardId: number): DeckCardMembershipResult {
  const deckExists = db.select({ id: deck.id }).from(deck).where(eq(deck.id, deckId)).get();
  if (!deckExists) {
    return { notFound: true };
  }

  db.delete(deckCard).where(and(eq(deckCard.deckId, deckId), eq(deckCard.cardId, cardId))).run();
  return { success: true };
}
