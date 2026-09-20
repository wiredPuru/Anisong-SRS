import { count, eq, gte, lt, lte, notInArray, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, reviewLog, song } from "../db/schema.ts";
import { getDueCardCount } from "./cards.ts";
import { getBoxOneStreakRequired } from "./mediaLibrary.ts";

export interface OverallStats {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
  streakDays: number;
}

export interface ReviewTimelineEntry {
  date: string;
  totalReviews: number;
  passCount: number;
  passRate: number | null;
}

export type ReviewTimelineRange = "30" | "90" | "all";

export interface ArtistStats {
  id: number;
  name: string;
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

export interface AnimeStats {
  id: number;
  titleEnglish: string;
  titleRomaji: string;
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

export const passCountExpr = sql<number>`coalesce(sum(case when ${reviewLog.result} = 'pass' then 1 else 0 end), 0)`;

export function deriveCounts(totalReviews: number, rawPassCount: number) {
  const passCount = Number(rawPassCount);
  return {
    totalReviews,
    passCount,
    failCount: totalReviews - passCount,
    passRate: totalReviews > 0 ? passCount / totalReviews : null,
  };
}

export function getOverallStats(): OverallStats {
  const row = db
    .select({ totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog)
    .get()!;

  return { ...deriveCounts(row.totalReviews, row.passCount), streakDays: getStudyStreak() };
}

// SQLite's date() treats a bare integer as a Julian day, not unix seconds, so
// the 'unixepoch' modifier is required; 'localtime' matches how a single
// local user reads "today" rather than the UTC calendar day.
const reviewDateExpr = sql<string>`date(${reviewLog.reviewedAt}, 'unixepoch', 'localtime')`;

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getStudyStreak(): number {
  const rows = db
    .selectDistinct({ date: reviewDateExpr })
    .from(reviewLog)
    .all();
  const reviewedDates = new Set(rows.map((r) => r.date));
  if (reviewedDates.size === 0) return 0;

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!reviewedDates.has(toLocalDateKey(cursor))) {
    // No review yet today doesn't break the streak until tomorrow.
    cursor.setDate(cursor.getDate() - 1);
    if (!reviewedDates.has(toLocalDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (reviewedDates.has(toLocalDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getReviewTimeline(range: ReviewTimelineRange): ReviewTimelineEntry[] {
  const query = db
    .select({ date: reviewDateExpr, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog);

  const rows =
    range === "all"
      ? query.groupBy(reviewDateExpr).orderBy(reviewDateExpr).all()
      : query
          .where(gte(reviewLog.reviewedAt, daysAgo(Number(range) - 1)))
          .groupBy(reviewDateExpr)
          .orderBy(reviewDateExpr)
          .all();

  return rows.map((row) => ({
    date: row.date,
    totalReviews: row.totalReviews,
    passCount: Number(row.passCount),
    passRate: row.totalReviews > 0 ? Number(row.passCount) / row.totalReviews : null,
  }));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function listArtistStats(): ArtistStats[] {
  return db
    .select({ id: artist.id, name: artist.name, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .leftJoin(reviewLog, eq(reviewLog.cardId, card.id))
    .groupBy(artist.id)
    .orderBy(artist.name)
    .all()
    .map((row) => ({ id: row.id, name: row.name, ...deriveCounts(row.totalReviews, row.passCount) }));
}

export function listAnimeStats(): AnimeStats[] {
  return db
    .select({
      id: anime.id,
      titleEnglish: anime.titleEnglish,
      titleRomaji: anime.titleRomaji,
      totalReviews: count(reviewLog.id),
      passCount: passCountExpr,
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .leftJoin(reviewLog, eq(reviewLog.cardId, card.id))
    .groupBy(anime.id)
    .orderBy(anime.titleEnglish)
    .all()
    .map((row) => ({
      id: row.id,
      titleEnglish: row.titleEnglish,
      titleRomaji: row.titleRomaji,
      ...deriveCounts(row.totalReviews, row.passCount),
    }));
}

// Sums raw counts across entries, then derives one rate from the totals -
// never average the per-day passRate values, since that misweights days
// with different review volumes.
export function summarizeTimeline(entries: ReviewTimelineEntry[]): { totalReviews: number; passRate: number | null } {
  const totalReviews = entries.reduce((sum, entry) => sum + entry.totalReviews, 0);
  const passCount = entries.reduce((sum, entry) => sum + entry.passCount, 0);
  return { totalReviews, passRate: totalReviews > 0 ? passCount / totalReviews : null };
}

export interface WeakestDeckEntry {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null;
  passRate: number;
  totalReviews: number;
}

// Pools artist and anime groupings into one ranked list (manual decks have no
// per-deck stats to rank, same gap the by-artist/by-title breakdown already
// has). minReviews filters out noisy low-sample decks before ranking.
export function getWeakestDecks(limit: number, minReviews: number): WeakestDeckEntry[] {
  const artistRows = db
    .select({ id: artist.id, name: artist.name, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .leftJoin(reviewLog, eq(reviewLog.cardId, card.id))
    .groupBy(artist.id)
    .all();

  const animeRows = db
    .select({
      id: anime.id,
      titleEnglish: anime.titleEnglish,
      coverImageUrl: anime.coverImageUrl,
      totalReviews: count(reviewLog.id),
      passCount: passCountExpr,
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .leftJoin(reviewLog, eq(reviewLog.cardId, card.id))
    .groupBy(anime.id)
    .all();

  const entries: WeakestDeckEntry[] = [];

  for (const row of artistRows) {
    const { passRate, totalReviews } = deriveCounts(row.totalReviews, row.passCount);
    if (passRate === null || totalReviews < minReviews) continue;
    entries.push({ type: "artist", id: row.id, label: row.name, coverImageUrl: null, passRate, totalReviews });
  }

  for (const row of animeRows) {
    const { passRate, totalReviews } = deriveCounts(row.totalReviews, row.passCount);
    if (passRate === null || totalReviews < minReviews) continue;
    entries.push({
      type: "anime",
      id: row.id,
      label: row.titleEnglish,
      coverImageUrl: row.coverImageUrl,
      passRate,
      totalReviews,
    });
  }

  entries.sort((a, b) => a.passRate - b.passRate);
  return entries.slice(0, limit);
}

// Box 4 is the first interval of a week or longer, which is what makes a card
// worth calling "mature" here. One constant so the panel label and the count
// can never drift apart.
export const MATURE_BOX = 4;
const MAX_BOX = 5;

export interface CollectionHealth {
  totalCards: number;
  neverReviewed: number;
  matureCards: number;
  maturePercent: number | null;
  // Sent rather than hard-coded client-side, so the label and the count keep
  // sharing one definition of "mature".
  matureBox: number;
  boxOneStreakRequired: number;
  boxes: { box: number; count: number }[];
  boxOneByStreak: { streak: number; count: number }[];
}

export interface CollectionHealthInput {
  boxCounts: { box: number; count: number }[];
  boxOneStreakCounts: { streak: number; count: number }[];
  neverReviewed: number;
  boxOneStreakRequired: number;
}

// Fills in every box and every box-1 streak bucket, including the ones no card
// currently occupies, so the UI can render a stable set of segments instead of
// a shape that changes with the data.
export function shapeCollectionHealth(input: CollectionHealthInput): CollectionHealth {
  const byBox = new Map(input.boxCounts.map((row) => [row.box, row.count]));
  const boxes = Array.from({ length: MAX_BOX }, (_, index) => ({
    box: index + 1,
    count: byBox.get(index + 1) ?? 0,
  }));

  const byStreak = new Map(input.boxOneStreakCounts.map((row) => [row.streak, row.count]));
  // A card needing N passes sits at streak 0..N-1 while still in box 1. A
  // stored streak past that range can only come from the requirement being
  // lowered after the fact, so it counts toward the last bucket rather than
  // vanishing.
  const lastBucket = Math.max(0, input.boxOneStreakRequired - 1);
  const boxOneByStreak = Array.from({ length: lastBucket + 1 }, (_, streak) => ({
    streak,
    count: streak === lastBucket ? sumFrom(byStreak, streak) : (byStreak.get(streak) ?? 0),
  }));

  const totalCards = boxes.reduce((sum, entry) => sum + entry.count, 0);
  const matureCards = boxes
    .filter((entry) => entry.box >= MATURE_BOX)
    .reduce((sum, entry) => sum + entry.count, 0);

  return {
    totalCards,
    neverReviewed: input.neverReviewed,
    matureCards,
    maturePercent: totalCards > 0 ? matureCards / totalCards : null,
    matureBox: MATURE_BOX,
    boxOneStreakRequired: input.boxOneStreakRequired,
    boxes,
    boxOneByStreak,
  };
}

function sumFrom(counts: Map<number, number>, from: number): number {
  let total = 0;
  for (const [streak, value] of counts) {
    if (streak >= from) total += value;
  }
  return total;
}

export function getCollectionHealth(): CollectionHealth {
  const boxCounts = db
    .select({ box: card.box, count: count(card.id) })
    .from(card)
    .groupBy(card.box)
    .all();

  const boxOneStreakCounts = db
    .select({ streak: card.streak, count: count(card.id) })
    .from(card)
    .where(eq(card.box, 1))
    .groupBy(card.streak)
    .all();

  const reviewedCardIds = db.selectDistinct({ id: reviewLog.cardId }).from(reviewLog);
  const neverReviewed = db
    .select({ count: count(card.id) })
    .from(card)
    .where(notInArray(card.id, reviewedCardIds))
    .get()!.count;

  return shapeCollectionHealth({
    boxCounts,
    boxOneStreakCounts,
    neverReviewed,
    boxOneStreakRequired: getBoxOneStreakRequired(),
  });
}

const FORECAST_DAYS = 30;
const FORECAST_VISIBLE_DAYS = 7;

export interface ReviewForecast {
  dueNow: number;
  backlog: number;
  days: { date: string; count: number }[];
  next7: number;
  next30: number;
}

export interface ReviewForecastInput {
  dueByDate: { date: string; count: number }[];
  // Local date keys, today first. Passed in rather than derived so the
  // bucketing stays pure and testable across month and DST boundaries.
  dayKeys: string[];
  dueNow: number;
  backlog: number;
}

export function forecastDayKeys(from: Date, count: number): string[] {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, () => {
    const key = toLocalDateKey(cursor);
    cursor.setDate(cursor.getDate() + 1);
    return key;
  });
}

// Anything already overdue lands in today's bucket rather than a row in the
// past, because today is when you actually face it.
export function shapeForecast(input: ReviewForecastInput): ReviewForecast {
  const todayKey = input.dayKeys[0] ?? "";
  const horizon = new Set(input.dayKeys);

  const counts = new Map<string, number>();
  for (const entry of input.dueByDate) {
    const bucket = entry.date <= todayKey ? todayKey : entry.date;
    if (!horizon.has(bucket)) continue;
    counts.set(bucket, (counts.get(bucket) ?? 0) + entry.count);
  }

  const days = input.dayKeys
    .slice(0, FORECAST_VISIBLE_DAYS)
    .map((date) => ({ date, count: counts.get(date) ?? 0 }));

  const sum = (keys: string[]) => keys.reduce((total, date) => total + (counts.get(date) ?? 0), 0);

  return {
    dueNow: input.dueNow,
    backlog: input.backlog,
    days,
    next7: sum(input.dayKeys.slice(0, FORECAST_VISIBLE_DAYS)),
    next30: sum(input.dayKeys),
  };
}

export function getReviewForecast(): ReviewForecast {
  const dayKeys = forecastDayKeys(new Date(), FORECAST_DAYS);
  const endExclusive = new Date();
  endExclusive.setHours(0, 0, 0, 0);
  endExclusive.setDate(endExclusive.getDate() + FORECAST_DAYS);

  const dueDateExpr = sql<string>`date(${card.nextReviewAt}, 'unixepoch', 'localtime')`;
  const dueByDate = db
    .select({ date: dueDateExpr, count: count(card.id) })
    .from(card)
    .where(lt(card.nextReviewAt, endExclusive))
    .groupBy(dueDateExpr)
    .all();

  const backlog = db
    .select({ count: count(card.id) })
    .from(card)
    .where(lte(card.nextReviewAt, new Date()))
    .get()!.count;

  return shapeForecast({
    dueByDate,
    dayKeys,
    // The one number Study itself answers with, so the two surfaces cannot
    // disagree about what is due: it honours the daily new-card cap, which a
    // plain nextReviewAt count does not.
    dueNow: getDueCardCount({ type: "all" }),
    backlog,
  });
}

export function clearReviewLog(): number {
  const result = db.delete(reviewLog).run();
  return result.changes;
}
