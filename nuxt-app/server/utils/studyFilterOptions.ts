import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";

export interface StudyFilterOptions {
  yearRange: { min: number; max: number } | null;
  formats: string[];
  genres: string[];
  tags: { name: string; count: number }[];
  missingDetailsCount: number;
}

// Only anime that have at least one card: offering a genre no card can match
// would just produce an empty queue.
export function getStudyFilterOptions(): StudyFilterOptions {
  const withCards = db.selectDistinct({ id: song.animeId }).from(song).innerJoin(card, eq(card.songId, song.id));
  const rows = db
    .select({
      year: anime.year,
      format: anime.format,
      genres: anime.genres,
      tags: anime.tags,
      checkedAt: anime.aniListDetailsCheckedAt,
    })
    .from(anime)
    .where(inArray(anime.id, withCards))
    .all();

  const years = rows.map((row) => row.year).filter((year): year is number => year !== null);
  const tagCounts = new Map<string, number>();
  for (const row of rows) {
    for (const name of new Set(row.tags.map((tag) => tag.name))) tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
  }

  return {
    yearRange: years.length ? { min: Math.min(...years), max: Math.max(...years) } : null,
    formats: [...new Set(rows.map((row) => row.format).filter((format): format is string => format !== null))].sort(),
    genres: [...new Set(rows.flatMap((row) => row.genres))].sort(),
    tags: [...tagCounts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    missingDetailsCount: rows.filter((row) => row.checkedAt === null).length,
  };
}
