import { count, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, reviewLog, song } from "../db/schema.ts";

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

export function clearReviewLog(): number {
  const result = db.delete(reviewLog).run();
  return result.changes;
}
