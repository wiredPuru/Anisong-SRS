import { existsSync, statSync, unlinkSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, deckCard, reviewLog, song } from "../db/schema.ts";
import { getDailyNewCardLimit, getThemesOnly, isPathWithinLibrary } from "./mediaLibrary.ts";
import { trackBoxExpr, trackDueCondition, trackNextReviewAtExpr, trackStreakExpr } from "./cardTrack.ts";
import { DEFAULT_GRADING_CRITERION, type GradingCriterion } from "./gradingCriterion.ts";
import { getOrCreateArtist } from "./lookup.ts";
import { PAGE_SIZE } from "./pagination.ts";
import { removeCachedStream } from "./streamCache.ts";
import { studyFilterCondition, type StudyFilters } from "./studyFilters.ts";

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  notes: string | null;
  box: number;
  streak: number;
  nextReviewAt: Date;
  createdAt: Date;
  songTitle: string;
  songTitleNative: string;
  themeSlot: string;
  artistId: number;
  artistName: string;
  animeId: number;
  animeAniListId: number;
  animeAnimethemesSlug: string | null;
  animethemesVideoSlug: string | null;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}

// box/streak/nextReviewAt describe whichever track was asked for, so the same
// CardWithDetails shape serves both /api/cards (always the title track) and
// /api/study/next (the active scope's track). The criterion travels alongside
// in the study response rather than being added to the card shape, which is
// hand-mirrored client-side (F-09) and must not drift.
const cardSelection = (criterion: GradingCriterion) => ({
  id: card.id,
  songId: card.songId,
  localVideoPath: card.localVideoPath,
  localAudioPath: card.localAudioPath,
  animethemesVideoUrl: card.animethemesVideoUrl,
  animethemesAudioUrl: card.animethemesAudioUrl,
  notes: card.notes,
  box: trackBoxExpr(criterion),
  streak: trackStreakExpr(criterion),
  nextReviewAt: trackNextReviewAtExpr(criterion),
  createdAt: card.createdAt,
  songTitle: song.title,
  songTitleNative: sql<string>`coalesce(${song.titleNative}, ${song.title})`,
  themeSlot: song.themeSlot,
  artistId: artist.id,
  artistName: artist.name,
  animeId: anime.id,
  animeAniListId: anime.aniListId,
  animeAnimethemesSlug: anime.animethemesSlug,
  animethemesVideoSlug: song.animethemesVideoSlug,
  animeTitleEnglish: anime.titleEnglish,
  animeTitleRomaji: anime.titleRomaji,
  animeTitleNative: anime.titleNative,
  animeCoverImageUrl: anime.coverImageUrl,
});

function cardQuery(criterion: GradingCriterion = DEFAULT_GRADING_CRITERION) {
  return db
    .select(cardSelection(criterion))
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id));
}

export function searchCards(query: string): CardWithDetails[] {
  return cardQuery().where(like(song.title, `%${query}%`)).orderBy(desc(card.createdAt)).limit(5).all();
}

export function cardSearchCondition(query?: string, missingAnimeThemesMatch?: boolean) {
  const trimmed = query?.trim();
  const pattern = trimmed ? `%${trimmed}%` : undefined;
  const textCondition = pattern
    ? or(
        like(song.title, pattern),
        like(artist.name, pattern),
        like(anime.titleEnglish, pattern),
        like(anime.titleRomaji, pattern),
        like(anime.titleNative, pattern),
      )
    : undefined;
  const matchCondition = missingAnimeThemesMatch ? isNull(song.animethemesThemeId) : undefined;

  if (textCondition && matchCondition) return and(textCondition, matchCondition);
  return textCondition ?? matchCondition;
}

export function listCards(page: number, query?: string, missingAnimeThemesMatch?: boolean): Paginated<CardWithDetails> {
  const condition = cardSearchCondition(query, missingAnimeThemesMatch);

  const totalBase = db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id));
  const total = (condition ? totalBase.where(condition) : totalBase).get()!.count;

  const itemsBase = cardQuery();
  const items = (condition ? itemsBase.where(condition) : itemsBase)
    .orderBy(desc(card.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

/** Every card id matching at least one active filter, newest first, unpaged. */
export function listCardIds(query: string, missingAnimeThemesMatch?: boolean): number[] {
  return db
    .select({ id: card.id })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(cardSearchCondition(query, missingAnimeThemesMatch))
    .orderBy(desc(card.createdAt))
    .all()
    .map((row) => row.id);
}

export function getCardWithDetails(
  id: number,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
): CardWithDetails | undefined {
  return cardQuery(criterion).where(eq(card.id, id)).get();
}

export function cardExistsForSong(songId: number): boolean {
  return db.select({ id: card.id }).from(card).where(eq(card.songId, songId)).get() !== undefined;
}

export function getCardsBySongIds(songIds: number[]): CardWithDetails[] {
  if (!songIds.length) return [];
  return cardQuery().where(inArray(card.songId, songIds)).all();
}

export function getCardsByIds(ids: number[]): CardWithDetails[] {
  if (!ids.length) return [];
  return cardQuery().where(inArray(card.id, ids)).all();
}

export function listCardsByArtist(artistId: number, page: number, query?: string): Paginated<CardWithDetails> {
  const searchCondition = cardSearchCondition(query);
  const scopeCondition = eq(artist.id, artistId);
  const condition = searchCondition ? and(scopeCondition, searchCondition) : scopeCondition;

  const total = db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(condition)
    .get()!.count;

  const items = cardQuery()
    .where(condition)
    .orderBy(desc(card.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

export function listCardsByAnime(animeId: number, page: number, query?: string): Paginated<CardWithDetails> {
  const searchCondition = cardSearchCondition(query);
  const scopeCondition = eq(anime.id, animeId);
  const condition = searchCondition ? and(scopeCondition, searchCondition) : scopeCondition;

  const total = db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(condition)
    .get()!.count;

  const items = cardQuery()
    .where(condition)
    .orderBy(desc(card.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

export function listCardsByManualDeck(deckId: number, page: number, query?: string): Paginated<CardWithDetails> {
  const searchCondition = cardSearchCondition(query);
  const scopeCondition = eq(deckCard.deckId, deckId);
  const condition = searchCondition ? and(scopeCondition, searchCondition) : scopeCondition;

  const total = db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(deckCard, eq(card.id, deckCard.cardId))
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(condition)
    .get()!.count;

  const items = cardQuery()
    .innerJoin(deckCard, eq(card.id, deckCard.cardId))
    .where(condition)
    .orderBy(desc(card.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  return { items, total };
}

export type StudyScope =
  | { type: "all" }
  | { type: "artist"; id: number }
  | { type: "anime"; id: number }
  | { type: "created"; id: number };

function countCardsIntroducedToday(criterion: GradingCriterion): number {
  const startOfTodaySeconds = Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000);
  return db
    .select({ cardId: reviewLog.cardId })
    .from(reviewLog)
    .groupBy(reviewLog.cardId)
    .where(eq(reviewLog.criterion, criterion))
    .having(sql`min(${reviewLog.reviewedAt}) >= ${startOfTodaySeconds}`)
    .all().length;
}

export function getNewCardsTodayInfo(
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
): { introduced: number; limit: number | null } {
  return { introduced: countCardsIntroducedToday(criterion), limit: getDailyNewCardLimit() };
}

// The due/new-card-limit condition shared by every due query, with no scope
// filter - grouped due-count queries (e.g. one deck per grid tile) apply this
// once and group by artist/anime id, rather than calling dueCardCondition
// per scope and recomputing the daily-limit lookup for every group.
// includeNewBeyondLimit releases the daily new-card cap for one caller only
// (Study's "Study new cards" action). It defaults to false so every other
// caller - deck-tile due counts, the Home dashboard - keeps honouring the
// limit without opting out.
export function baseDueCondition(
  includeNewBeyondLimit = false,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
) {
  const isDue = trackDueCondition(criterion);
  // A subquery, not a join, so the callers sharing this condition keep their
  // own join lists (deck tile counts group by artist/anime id).
  const dueCondition = getThemesOnly()
    ? and(isDue, inArray(card.songId, db.select({ id: song.id }).from(song).where(isNotNull(song.animethemesThemeId))))
    : isDue;

  const { introduced, limit } = getNewCardsTodayInfo(criterion);
  if (!includeNewBeyondLimit && limit !== null && introduced >= limit) {
    // Scoped to this criterion: a card already reviewed for its title is still
    // a new card the first time it comes up for its song.
    const reviewedCardIds = db
      .select({ id: reviewLog.cardId })
      .from(reviewLog)
      .where(eq(reviewLog.criterion, criterion));
    return and(dueCondition, inArray(card.id, reviewedCardIds));
  }

  return dueCondition;
}

function scopeFilter(scope: StudyScope) {
  if (scope.type === "artist") return eq(artist.id, scope.id);
  if (scope.type === "anime") return eq(anime.id, scope.id);
  // A subquery rather than a join, so the due queries sharing this condition
  // keep their existing join lists.
  if (scope.type === "created") {
    return inArray(card.id, db.select({ id: deckCard.cardId }).from(deckCard).where(eq(deckCard.deckId, scope.id)));
  }
  return undefined;
}

// filters narrow Study only (feature 76b); baseDueCondition stays filter-free
// because deck tiles and Home group by it.
function dueCardCondition(
  scope: StudyScope,
  includeNewBeyondLimit = false,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
  filters: StudyFilters | null = null,
) {
  return and(baseDueCondition(includeNewBeyondLimit, criterion), scopeFilter(scope), studyFilterCondition(filters));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

// A stable pseudo-random rank for a card on a given day - same (id, dayKey)
// always yields the same value, but neighboring ids don't yield neighboring
// ranks (a naive hash keyed only on the low digits of `id` would, which
// degenerates back into insertion order for consecutive ids).
function dailyTieBreakRank(id: number, dayKey: number): number {
  const combined = (Math.imul(dayKey, 0x9e3779b1) ^ Math.imul(id, 0x85ebca6b)) >>> 0;
  return mix32(combined);
}

// Cards due together (e.g. a bulk import, or several box-1 fails from the
// same session) share the same nextReviewAt. Ties break by a per-card rank
// seeded on the calendar day (UTC) rather than Math.random(): a genuinely
// more-overdue card (an earlier day) still wins, and same-day ties get a
// pseudo-random order that only changes when the day rolls over - instead of
// the same fixed row-insertion order forever, without reshuffling on every
// single call within one day. That stability is load-bearing, not
// incidental: getUpcomingDueCards's prefetch guess (server/api/study/next.get.ts)
// only warms the stream cache usefully if the *next* /api/study/next call
// actually serves the cards it predicted, which a fresh random draw every
// call made unlikely as soon as more than a couple of cards were tied on the
// same day. `pool` must already be sorted ascending by nextReviewAt.
export function pickRandomDueOrder<T extends { id: number; nextReviewAt: Date }>(
  pool: readonly T[],
  count: number,
  now: Date = new Date(),
): T[] {
  const dayKey = Math.floor(now.getTime() / DAY_MS);
  const remaining = [...pool];
  const picks: T[] = [];

  while (remaining.length > 0 && picks.length < count) {
    const earliestDay = Math.floor(remaining[0].nextReviewAt.getTime() / DAY_MS);
    let chosenIndex = -1;
    let chosenRank = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      if (Math.floor(remaining[index].nextReviewAt.getTime() / DAY_MS) !== earliestDay) continue;
      const rank = dailyTieBreakRank(remaining[index].id, dayKey);
      if (chosenIndex === -1 || rank < chosenRank) {
        chosenIndex = index;
        chosenRank = rank;
      }
    }
    picks.push(remaining[chosenIndex]);
    remaining.splice(chosenIndex, 1);
  }

  return picks;
}

export function getNextDueCard(
  scope: StudyScope,
  includeNewBeyondLimit = false,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
  filters: StudyFilters | null = null,
): CardWithDetails | undefined {
  const pool = cardQuery(criterion)
    .where(dueCardCondition(scope, includeNewBeyondLimit, criterion, filters))
    .orderBy(asc(trackNextReviewAtExpr(criterion)))
    .all();
  return pickRandomDueOrder(pool, 1)[0];
}

// A best-effort snapshot of the next `limit` due cards after `excludeCardId`,
// for prefetching - not a guarantee, since the real due order can shift once
// the excluded card is actually reviewed (see current-feature.md notes), and
// now also shuffled the same way getNextDueCard is so the prefetch list stays
// consistent with what tends to actually get served next.
export function getUpcomingDueCards(
  scope: StudyScope,
  excludeCardId: number | undefined,
  limit: number,
  includeNewBeyondLimit = false,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
  filters: StudyFilters | null = null,
): CardWithDetails[] {
  const base = dueCardCondition(scope, includeNewBeyondLimit, criterion, filters);
  const condition = excludeCardId !== undefined ? and(base, ne(card.id, excludeCardId)) : base;
  const pool = cardQuery(criterion).where(condition).orderBy(asc(trackNextReviewAtExpr(criterion))).all();
  return pickRandomDueOrder(pool, limit);
}

export function getDueCardCount(
  scope: StudyScope,
  includeNewBeyondLimit = false,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
  filters: StudyFilters | null = null,
): number {
  return db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(dueCardCondition(scope, includeNewBeyondLimit, criterion, filters))
    .get()!.count;
}

// How many never-reviewed cards the daily cap is currently holding back, which
// is what decides whether Study offers its "Study new cards" action at all.
// Zero when no limit is set or the limit is not yet spent: in both of those
// cases new cards are already being served normally, so nothing is withheld.
export function getWithheldNewCount(
  scope: StudyScope,
  criterion: GradingCriterion = DEFAULT_GRADING_CRITERION,
  filters: StudyFilters | null = null,
): number {
  const { introduced, limit } = getNewCardsTodayInfo(criterion);
  if (limit === null || introduced < limit) return 0;

  const reviewedCardIds = db
    .select({ id: reviewLog.cardId })
    .from(reviewLog)
    .where(eq(reviewLog.criterion, criterion));
  return db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(dueCardCondition(scope, true, criterion, filters), notInArray(card.id, reviewedCardIds)))
    .get()!.count;
}

// "New" means never reviewed at all (zero ReviewLog rows), not box === 1 -
// a failed card also resets to box 1, and that isn't "new".
export function getDueCardBreakdown(scope: StudyScope): { due: number; new: number } {
  const condition = dueCardCondition(scope);
  const reviewedCardIds = db
    .select({ id: reviewLog.cardId })
    .from(reviewLog)
    .where(eq(reviewLog.criterion, DEFAULT_GRADING_CRITERION));

  const due = db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(condition)
    .get()!.count;

  const newCount = db
    .select({ count: count(card.id) })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(condition, notInArray(card.id, reviewedCardIds)))
    .get()!.count;

  return { due, new: newCount };
}

// Learning/mature is a new, documented split (no existing tier concept to
// match): box 1-2 = learning (0-1 day intervals, still forming), box 3-5 =
// mature (3+ day intervals).
export function getCardMaturityBreakdown(): { learning: number; mature: number } {
  const row = db
    .select({
      learning: sql<number>`coalesce(sum(case when ${card.box} < 3 then 1 else 0 end), 0)`,
      mature: sql<number>`coalesce(sum(case when ${card.box} >= 3 then 1 else 0 end), 0)`,
    })
    .from(card)
    .get()!;
  return { learning: Number(row.learning), mature: Number(row.mature) };
}

export function listRecentCards(limit: number): CardWithDetails[] {
  return cardQuery().orderBy(desc(card.createdAt)).limit(limit).all();
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

  if (cardExistsForSong(input.songId)) {
    return { error: "A card for this song already exists." };
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
  notes?: string | null;
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
    }
  }

  const updates: { localVideoPath?: string | null; localAudioPath?: string | null; notes?: string | null } = {};
  const clearedLocalPaths: string[] = [];

  if (input.notes !== undefined) {
    const trimmed = input.notes?.trim() ?? "";
    updates.notes = trimmed === "" ? null : trimmed;
  }

  if (input.localVideoPath !== undefined) {
    if (input.localVideoPath === null) {
      updates.localVideoPath = null;
      if (existing.localVideoPath) clearedLocalPaths.push(existing.localVideoPath);
    } else {
      const result = validateLocalPath(input.localVideoPath);
      if ("error" in result) return result;
      updates.localVideoPath = result.path;
    }
  }

  if (input.localAudioPath !== undefined) {
    if (input.localAudioPath === null) {
      updates.localAudioPath = null;
      if (existing.localAudioPath) clearedLocalPaths.push(existing.localAudioPath);
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

  db.transaction(() => {
    if (input.artistMode !== undefined) {
      const name = input.artistName!.trim();
      if (input.artistMode === "rename") {
        db.update(artist).set({ name }).where(eq(artist.id, songRow.artistId)).run();
      } else {
        const targetArtist = getOrCreateArtist(name);
        db.update(song).set({ artistId: targetArtist.id }).where(eq(song.id, songRow.id)).run();
      }
    }
    if (Object.keys(songUpdates).length > 0) {
      db.update(song).set(songUpdates).where(eq(song.id, songRow.id)).run();
    }
    if (Object.keys(updates).length > 0) {
      db.update(card).set(updates).where(eq(card.id, input.id)).run();
    }
  });

  for (const path of clearedLocalPaths) {
    deleteFileIfUnreferenced(path);
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
  removeFileQuietly(path);
}

function removeFileQuietly(path: string): void {
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // Best-effort cleanup - a permission error or a file that vanished
    // underneath us just means it stays behind, same as before this feature.
  }
}

export function pathsToRemove(
  candidates: readonly (string | null)[],
  stillReferenced: readonly (string | null)[],
): string[] {
  const kept = new Set(stillReferenced);
  const unique = new Set(candidates.filter((path): path is string => path !== null));
  return [...unique].filter((path) => !kept.has(path));
}

function unreferencedAfterDelete(
  candidates: (string | null)[],
  videoColumn: typeof card.localVideoPath | typeof card.animethemesVideoUrl,
  audioColumn: typeof card.localAudioPath | typeof card.animethemesAudioUrl,
): string[] {
  const values = candidates.filter((value): value is string => value !== null);
  if (values.length === 0) return [];
  const stillReferenced = db
    .select({ video: videoColumn, audio: audioColumn })
    .from(card)
    .where(or(inArray(videoColumn, values), inArray(audioColumn, values)))
    .all()
    .flatMap((row) => [row.video, row.audio]);
  return pathsToRemove(candidates, stillReferenced);
}

export interface DeleteCardsResult {
  deleted: number[];
  notFound: number[];
}

export function deleteCards(ids: readonly number[]): DeleteCardsResult {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return { deleted: [], notFound: [] };

  const existing = db.select().from(card).where(inArray(card.id, uniqueIds)).all();
  const deleted = existing.map((row) => row.id);
  const found = new Set(deleted);
  const notFound = uniqueIds.filter((id) => !found.has(id));
  if (deleted.length === 0) return { deleted, notFound };

  db.delete(card).where(inArray(card.id, deleted)).run();

  // Checked only after every row is gone, so two cards deleted together that
  // share one file or URL don't each see the other as still referencing it.
  const paths = existing.flatMap((row) => [row.localVideoPath, row.localAudioPath]);
  for (const path of unreferencedAfterDelete(paths, card.localVideoPath, card.localAudioPath)) {
    removeFileQuietly(path);
  }

  const urls = existing.flatMap((row) => [row.animethemesVideoUrl, row.animethemesAudioUrl]);
  for (const url of unreferencedAfterDelete(urls, card.animethemesVideoUrl, card.animethemesAudioUrl)) {
    removeCachedStream(url);
  }

  return { deleted, notFound };
}

export function deleteCard(id: number): boolean {
  return deleteCards([id]).deleted.length > 0;
}
