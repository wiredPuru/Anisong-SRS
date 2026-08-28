import { count, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, reviewLog, song } from "../db/schema.ts";

export interface OverallStats {
  totalReviews: number;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

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

const passCountExpr = sql<number>`coalesce(sum(case when ${reviewLog.result} = 'pass' then 1 else 0 end), 0)`;

function deriveCounts(totalReviews: number, rawPassCount: number) {
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

  return deriveCounts(row.totalReviews, row.passCount);
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
