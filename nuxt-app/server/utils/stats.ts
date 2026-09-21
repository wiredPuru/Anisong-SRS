import { and, count, eq, gte, lt, lte, notInArray, sql } from "drizzle-orm";
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

export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MS_PER_DAY = 86_400_000;

// UTC day numbers, so two consecutive calendar dates are always exactly 1
// apart, including across a daylight-saving change where a local day is 23 or
// 25 hours long.
export function dateKeyToDayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / MS_PER_DAY;
}

function dayNumberToDateKey(dayNumber: number): string {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

// No review yet today doesn't break the streak until tomorrow, so counting
// starts from yesterday when today has none.
export function currentStreakFromDates(dates: Iterable<string>, todayKey: string): number {
  const days = new Set([...dates].map(dateKeyToDayNumber));
  let cursor = dateKeyToDayNumber(todayKey);
  if (!days.has(cursor)) cursor -= 1;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor -= 1;
  }
  return streak;
}

export function getStudyStreak(): number {
  const rows = db
    .selectDistinct({ date: reviewDateExpr })
    .from(reviewLog)
    .all();
  return currentStreakFromDates(
    rows.map((r) => r.date),
    toLocalDateKey(new Date()),
  );
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

export const ROLLING_WINDOW_DAYS = 7;

export interface RollingPassRate {
  date: string;
  passRate: number;
}

// UTC arithmetic on a plain date key, so a DST boundary cannot shift the
// window by a day the way local midnight can.
function shiftDateKey(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

// Smooths the per-day pass rate over a trailing window of CALENDAR days, not
// of entries. getReviewTimeline only returns days that had reviews, so a
// window counted in entries would silently stretch across weeks of not
// studying and average them as if they were consecutive.
export function rollingPassRates(entries: ReviewTimelineEntry[], windowDays: number): RollingPassRate[] {
  let start = 0;
  let totalReviews = 0;
  let passCount = 0;

  return entries.map((entry, index) => {
    totalReviews += entry.totalReviews;
    passCount += entry.passCount;

    const cutoff = shiftDateKey(entry.date, -(windowDays - 1));
    while (start <= index && entries[start]!.date < cutoff) {
      totalReviews -= entries[start]!.totalReviews;
      passCount -= entries[start]!.passCount;
      start++;
    }

    // An entry only exists for a day that had reviews, so the window can only
    // be empty if a caller hands in a zero-review day.
    return { date: entry.date, passRate: totalReviews > 0 ? passCount / totalReviews : 0 };
  });
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

export type ThemeKind = "OP" | "ED" | "other";

const THEME_KINDS: ThemeKind[] = ["OP", "ED", "other"];

export interface RetentionEntry {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

export interface RetentionStats {
  byBox: (RetentionEntry & { box: number })[];
  byThemeKind: (RetentionEntry & { kind: ThemeKind })[];
}

export interface RetentionInput {
  byBox: { box: number; totalReviews: number; passCount: number }[];
  byThemeSlot: { themeSlot: string; totalReviews: number; passCount: number }[];
}

// themeSlot is free text: imports and hand edits have produced "OP1", "ED",
// and the occasional oddity, so anything that isn't clearly an opening or an
// ending keeps its reviews in a visible bucket rather than being dropped.
export function classifyThemeSlot(slot: string): ThemeKind {
  const normalized = slot.trim().toUpperCase();
  if (normalized.startsWith("OP")) return "OP";
  if (normalized.startsWith("ED")) return "ED";
  return "other";
}

// Fills every box and every theme kind, including ones with no reviews, so the
// panel renders a stable ladder instead of a shape that moves with the data -
// the same call shapeCollectionHealth makes.
export function shapeRetention(input: RetentionInput): RetentionStats {
  const boxTotals = new Map(input.byBox.map((row) => [row.box, row]));
  const byBox = Array.from({ length: MAX_BOX }, (_, index) => {
    const box = index + 1;
    const row = boxTotals.get(box);
    return { box, ...deriveCounts(row?.totalReviews ?? 0, row?.passCount ?? 0) };
  });

  const kindTotals = new Map<ThemeKind, { totalReviews: number; passCount: number }>();
  for (const row of input.byThemeSlot) {
    const kind = classifyThemeSlot(row.themeSlot);
    const running = kindTotals.get(kind) ?? { totalReviews: 0, passCount: 0 };
    kindTotals.set(kind, {
      totalReviews: running.totalReviews + row.totalReviews,
      passCount: running.passCount + Number(row.passCount),
    });
  }

  const byThemeKind = THEME_KINDS.map((kind) => {
    const row = kindTotals.get(kind);
    return { kind, ...deriveCounts(row?.totalReviews ?? 0, row?.passCount ?? 0) };
  });

  return { byBox, byThemeKind };
}

export function getRetentionStats(): RetentionStats {
  // boxBefore, not boxAfter: the question is whether a card held at the box it
  // had already reached, which boxAfter has already answered by moving it.
  const byBox = db
    .select({ box: reviewLog.boxBefore, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog)
    .groupBy(reviewLog.boxBefore)
    .all();

  const byThemeSlot = db
    .select({ themeSlot: song.themeSlot, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog)
    .innerJoin(card, eq(reviewLog.cardId, card.id))
    .innerJoin(song, eq(card.songId, song.id))
    .groupBy(song.themeSlot)
    .all();

  return shapeRetention({ byBox, byThemeSlot });
}

export const WEEK_DAYS = 7;

export interface WeekWindow {
  totalReviews: number;
  passRate: number | null;
}

export interface WeekOverWeek {
  current: WeekWindow;
  previous: WeekWindow;
  delta: number | null;
}

export interface WeekOverWeekInput {
  current: { totalReviews: number; passCount: number };
  previous: { totalReviews: number; passCount: number };
}

// A week with no reviews has no rate to compare, so the delta stays null
// rather than reading a first week of study as a jump up from zero.
export function shapeWeekOverWeek(input: WeekOverWeekInput): WeekOverWeek {
  const current = deriveCounts(input.current.totalReviews, input.current.passCount);
  const previous = deriveCounts(input.previous.totalReviews, input.previous.passCount);
  const delta =
    current.passRate !== null && previous.passRate !== null ? current.passRate - previous.passRate : null;

  return {
    current: { totalReviews: current.totalReviews, passRate: current.passRate },
    previous: { totalReviews: previous.totalReviews, passRate: previous.passRate },
    delta,
  };
}

function reviewTotalsBetween(from: Date, to: Date | null): { totalReviews: number; passCount: number } {
  const row = db
    .select({ totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog)
    .where(to ? and(gte(reviewLog.reviewedAt, from), lt(reviewLog.reviewedAt, to)) : gte(reviewLog.reviewedAt, from))
    .get()!;

  return { totalReviews: row.totalReviews, passCount: Number(row.passCount) };
}

export function getWeekOverWeek(): WeekOverWeek {
  const currentStart = daysAgo(WEEK_DAYS - 1);
  const previousStart = daysAgo(WEEK_DAYS * 2 - 1);

  return shapeWeekOverWeek({
    current: reviewTotalsBetween(currentStart, null),
    previous: reviewTotalsBetween(previousStart, currentStart),
  });
}

// The movers compare a recent window against everything older. A deck needs
// TREND_MIN_REVIEWS in BOTH windows to rank: one noisy review either side
// would otherwise swing a deck to the top of a list on nothing.
export const TREND_RECENT_DAYS = 30;
export const TREND_MIN_REVIEWS = 3;
export const TREND_LIMIT = 3;

export interface DeckTrendEntry {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null;
  recentRate: number;
  recentReviews: number;
  olderRate: number;
  olderReviews: number;
  delta: number;
}

export interface DeckTrendInput {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null;
  recentReviews: number;
  recentPasses: number;
  olderReviews: number;
  olderPasses: number;
}

export interface DeckTrends {
  improved: DeckTrendEntry[];
  declined: DeckTrendEntry[];
}

export function shapeDeckTrends(
  rows: DeckTrendInput[],
  options: { minReviews: number; limit: number },
): DeckTrends {
  const ranked: DeckTrendEntry[] = [];

  for (const row of rows) {
    // A deck with no older reviews has no baseline, so it is excluded rather
    // than ranked as having improved from nothing.
    if (row.recentReviews < options.minReviews || row.olderReviews < options.minReviews) continue;

    const recentRate = row.recentPasses / row.recentReviews;
    const olderRate = row.olderPasses / row.olderReviews;
    const delta = recentRate - olderRate;
    if (delta === 0) continue;

    ranked.push({
      type: row.type,
      id: row.id,
      label: row.label,
      coverImageUrl: row.coverImageUrl,
      recentRate,
      recentReviews: row.recentReviews,
      olderRate,
      olderReviews: row.olderReviews,
      delta,
    });
  }

  const improved = ranked.filter((entry) => entry.delta > 0).sort((a, b) => b.delta - a.delta);
  const declined = ranked.filter((entry) => entry.delta < 0).sort((a, b) => a.delta - b.delta);

  return { improved: improved.slice(0, options.limit), declined: declined.slice(0, options.limit) };
}

function windowCountExprs(cutoffSeconds: number) {
  return {
    recentReviews: sql<number>`coalesce(sum(case when ${reviewLog.reviewedAt} >= ${cutoffSeconds} then 1 else 0 end), 0)`,
    recentPasses: sql<number>`coalesce(sum(case when ${reviewLog.reviewedAt} >= ${cutoffSeconds} and ${reviewLog.result} = 'pass' then 1 else 0 end), 0)`,
    olderReviews: sql<number>`coalesce(sum(case when ${reviewLog.reviewedAt} < ${cutoffSeconds} then 1 else 0 end), 0)`,
    olderPasses: sql<number>`coalesce(sum(case when ${reviewLog.reviewedAt} < ${cutoffSeconds} and ${reviewLog.result} = 'pass' then 1 else 0 end), 0)`,
  };
}

export function getDeckTrends(): DeckTrends {
  const cutoffSeconds = Math.floor(daysAgo(TREND_RECENT_DAYS - 1).getTime() / 1000);
  const windows = windowCountExprs(cutoffSeconds);

  const artistRows = db
    .select({ id: artist.id, label: artist.name, ...windows })
    .from(reviewLog)
    .innerJoin(card, eq(reviewLog.cardId, card.id))
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .groupBy(artist.id)
    .all();

  const animeRows = db
    .select({ id: anime.id, label: anime.titleEnglish, coverImageUrl: anime.coverImageUrl, ...windows })
    .from(reviewLog)
    .innerJoin(card, eq(reviewLog.cardId, card.id))
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .groupBy(anime.id)
    .all();

  const toInput = (
    row: { id: number; label: string; coverImageUrl?: string | null } & Record<string, unknown>,
    type: "artist" | "anime",
  ): DeckTrendInput => ({
    type,
    id: row.id,
    label: row.label,
    coverImageUrl: row.coverImageUrl ?? null,
    recentReviews: Number(row.recentReviews),
    recentPasses: Number(row.recentPasses),
    olderReviews: Number(row.olderReviews),
    olderPasses: Number(row.olderPasses),
  });

  return shapeDeckTrends(
    [...artistRows.map((row) => toInput(row, "artist")), ...animeRows.map((row) => toInput(row, "anime"))],
    { minReviews: TREND_MIN_REVIEWS, limit: TREND_LIMIT },
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ReviewHeatmapDay {
  date: string;
  count: number;
  future: boolean;
}

export interface ReviewHeatmapWeek {
  days: ReviewHeatmapDay[];
  monthLabel: string | null;
}

export interface ReviewHeatmap {
  weeks: ReviewHeatmapWeek[];
  maxCount: number;
  totalReviews: number;
}

export interface ReviewHeatmapInput {
  countsByDate: { date: string; count: number }[];
  // Local date keys, Sunday-aligned start, spanning whole weeks through the
  // Saturday of today's own week. Passed in rather than derived so shaping
  // stays pure and testable across month and DST boundaries.
  dayKeys: string[];
  todayKey: string;
}

function startOfWeekSunday(d: Date): Date {
  const cursor = new Date(d);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  return cursor;
}

// Ascending local date keys spanning `weeks` whole Sunday-to-Saturday weeks,
// ending on the Saturday of today's own week - always a multiple of 7 so
// shapeReviewHeatmap can chunk the result into whole weeks.
export function heatmapDayKeys(today: Date, weeks: number): string[] {
  const todayWeekStart = startOfWeekSunday(today);
  const gridStart = new Date(todayWeekStart);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);
  return forecastDayKeys(gridStart, weeks * 7);
}

// Days after today (the unplayed rest of the current week) are blanked
// rather than shown as zero, and excluded from maxCount/totalReviews so a
// half-empty final week can't drag the intensity scale down.
export function shapeReviewHeatmap(input: ReviewHeatmapInput): ReviewHeatmap {
  const counts = new Map(input.countsByDate.map((entry) => [entry.date, entry.count]));

  let maxCount = 0;
  let totalReviews = 0;
  const days: ReviewHeatmapDay[] = input.dayKeys.map((date) => {
    const future = date > input.todayKey;
    const count = future ? 0 : (counts.get(date) ?? 0);
    if (!future) {
      totalReviews += count;
      if (count > maxCount) maxCount = count;
    }
    return { date, count, future };
  });

  const weeks: ReviewHeatmapWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const weekDays = days.slice(i, i + 7);
    const firstOfMonth = weekDays.find((day) => Number(day.date.slice(8, 10)) === 1);
    const monthLabel = firstOfMonth ? (MONTH_NAMES[Number(firstOfMonth.date.slice(5, 7)) - 1] ?? null) : null;
    weeks.push({ days: weekDays, monthLabel });
  }

  return { weeks, maxCount, totalReviews };
}

const HEATMAP_WEEKS = 53;

export function getReviewHeatmap(): ReviewHeatmap {
  const today = new Date();
  const dayKeys = heatmapDayKeys(today, HEATMAP_WEEKS);
  const [y, m, d] = dayKeys[0]!.split("-").map(Number);
  const startDate = new Date(y!, m! - 1, d);

  const countsByDate = db
    .select({ date: reviewDateExpr, count: count(reviewLog.id) })
    .from(reviewLog)
    .where(gte(reviewLog.reviewedAt, startDate))
    .groupBy(reviewDateExpr)
    .all();

  return shapeReviewHeatmap({ countsByDate, dayKeys, todayKey: toLocalDateKey(today) });
}

export interface LongestStreak {
  days: number;
  start: string;
  end: string;
}

// Runs of consecutive dates; a tie goes to the most recent run, since that is
// the one still worth beating.
export function longestStreakFromDates(dates: Iterable<string>): LongestStreak | null {
  const days = [...new Set([...dates].map(dateKeyToDayNumber))].sort((x, y) => x - y);
  if (days.length === 0) return null;

  const runs: LongestStreak[] = [];
  let runStart = days[0]!;
  for (let i = 1; i <= days.length; i++) {
    const previous = days[i - 1]!;
    if (days[i] === previous + 1) continue;
    runs.push({
      days: previous - runStart + 1,
      start: dayNumberToDateKey(runStart),
      end: dayNumberToDateKey(previous),
    });
    runStart = days[i]!;
  }
  return runs.reduce((best, run) => (run.days >= best.days ? run : best));
}

export interface StudyRecords {
  totalDaysStudied: number;
  currentStreak: number;
  longestStreak: LongestStreak | null;
  bestDay: { date: string; count: number } | null;
}

export interface StudyRecordsInput {
  dayCounts: { date: string; count: number }[];
  todayKey: string;
}

export function shapeStudyRecords(input: StudyRecordsInput): StudyRecords {
  const countsByDate = new Map<string, number>();
  for (const entry of input.dayCounts) {
    countsByDate.set(entry.date, (countsByDate.get(entry.date) ?? 0) + entry.count);
  }

  let bestDay: StudyRecords["bestDay"] = null;
  for (const [date, count] of countsByDate) {
    if (!bestDay || count > bestDay.count || (count === bestDay.count && date > bestDay.date)) {
      bestDay = { date, count };
    }
  }

  return {
    totalDaysStudied: countsByDate.size,
    currentStreak: currentStreakFromDates(countsByDate.keys(), input.todayKey),
    longestStreak: longestStreakFromDates(countsByDate.keys()),
    bestDay,
  };
}

export function getStudyRecords(): StudyRecords {
  const dayCounts = db
    .select({ date: reviewDateExpr, count: count(reviewLog.id) })
    .from(reviewLog)
    .groupBy(reviewDateExpr)
    .all();

  return shapeStudyRecords({ dayCounts, todayKey: toLocalDateKey(new Date()) });
}

export const RHYTHM_MIN_REVIEWS = 5;

export interface RhythmBucket {
  totalReviews: number;
  passCount: number;
  passRate: number | null;
}

export interface HourOfDayEntry extends RhythmBucket {
  hour: number;
}

export interface WeekdayEntry extends RhythmBucket {
  weekday: number;
}

export interface StudyRhythm {
  minReviews: number;
  hours: HourOfDayEntry[];
  weekdays: WeekdayEntry[];
}

export interface StudyRhythmInput {
  hourRows: { hour: number; totalReviews: number; passCount: number }[];
  weekdayRows: { weekday: number; totalReviews: number; passCount: number }[];
}

function shapeRhythmBuckets(
  rows: { index: number; totalReviews: number; passCount: number }[],
  size: number,
): RhythmBucket[] {
  const totals = Array.from({ length: size }, () => ({ totalReviews: 0, passCount: 0 }));
  for (const row of rows) {
    const bucket = totals[row.index];
    if (!Number.isInteger(row.index) || !bucket) continue;
    bucket.totalReviews += row.totalReviews;
    bucket.passCount += Number(row.passCount);
  }
  return totals.map(({ totalReviews, passCount }) => {
    const { passRate } = deriveCounts(totalReviews, passCount);
    return { totalReviews, passCount, passRate };
  });
}

// Always 24 hours and 7 weekdays, empty ones included, so the UI renders a
// stable axis. Weekdays are Sunday-first (0 = Sunday), matching the heatmap.
export function shapeStudyRhythm(input: StudyRhythmInput): StudyRhythm {
  const hours = shapeRhythmBuckets(
    input.hourRows.map((row) => ({ ...row, index: row.hour })),
    24,
  ).map((bucket, hour) => ({ hour, ...bucket }));

  const weekdays = shapeRhythmBuckets(
    input.weekdayRows.map((row) => ({ ...row, index: row.weekday })),
    7,
  ).map((bucket, weekday) => ({ weekday, ...bucket }));

  return { minReviews: RHYTHM_MIN_REVIEWS, hours, weekdays };
}

export function getStudyRhythm(): StudyRhythm {
  const clockPart = (format: "%H" | "%w") =>
    sql<number>`cast(strftime(${format}, ${reviewLog.reviewedAt}, 'unixepoch', 'localtime') as integer)`;
  const hourExpr = clockPart("%H");
  const weekdayExpr = clockPart("%w");

  const hourRows = db
    .select({ hour: hourExpr, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog)
    .groupBy(hourExpr)
    .all();

  const weekdayRows = db
    .select({ weekday: weekdayExpr, totalReviews: count(reviewLog.id), passCount: passCountExpr })
    .from(reviewLog)
    .groupBy(weekdayExpr)
    .all();

  return shapeStudyRhythm({ hourRows, weekdayRows });
}

export function clearReviewLog(): number {
  const result = db.delete(reviewLog).run();
  return result.changes;
}
