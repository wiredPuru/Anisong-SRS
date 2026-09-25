import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";

export interface StudyFilterOptions {
  yearRange: { min: number; max: number } | null;
  formats: string[];
  genres: string[];
  // One relevance rank per show with the tag, so the client can count shows
  // at whatever minimum relevance the filter is set to.
  tags: { name: string; ranks: number[] }[];
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
  const tagRanks = new Map<string, number[]>();
  for (const row of rows) {
    const best = new Map<string, number>();
    for (const tag of row.tags) best.set(tag.name, Math.max(best.get(tag.name) ?? 0, tag.rank));
    for (const [name, rank] of best) tagRanks.set(name, [...(tagRanks.get(name) ?? []), rank]);
  }

  return {
    yearRange: years.length ? { min: Math.min(...years), max: Math.max(...years) } : null,
    formats: [...new Set(rows.map((row) => row.format).filter((format): format is string => format !== null))].sort(),
    genres: [...new Set(rows.flatMap((row) => row.genres))].sort(),
    tags: [...tagRanks]
      .map(([name, ranks]) => ({ name, ranks }))
      .sort((a, b) => b.ranks.length - a.ranks.length || a.name.localeCompare(b.name)),
    missingDetailsCount: rows.filter((row) => row.checkedAt === null).length,
  };
}
