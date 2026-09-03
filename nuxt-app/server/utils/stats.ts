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

export function clearReviewLog(): number {
  const result = db.delete(reviewLog).run();
  return result.changes;
}
