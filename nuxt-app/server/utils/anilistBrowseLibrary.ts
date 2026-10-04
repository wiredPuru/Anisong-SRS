import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { AniListBrowseItem } from "../lib/anilistBrowse.ts";

export interface BrowseAnime extends Omit<AniListBrowseItem, "popularity"> {
  inLibrary: boolean;
  cardCount: number;
}

/** Marks each catalog result with whether the library holds cards for it. */
export function withLibraryFlags(items: AniListBrowseItem[]): BrowseAnime[] {
  if (items.length === 0) return [];
  const counts = new Map(
    db
      .select({ aniListId: anime.aniListId, cardCount: sql<number>`count(${card.id})` })
      .from(card)
      .innerJoin(song, eq(card.songId, song.id))
      .innerJoin(anime, eq(song.animeId, anime.id))
      .where(inArray(anime.aniListId, items.map((item) => item.aniListId)))
      .groupBy(anime.aniListId)
      .all()
      .map((row) => [row.aniListId, Number(row.cardCount)]),
  );
  return items.map(({ popularity: _popularity, ...item }) => {
    const cardCount = counts.get(item.aniListId) ?? 0;
    return { ...item, inLibrary: cardCount > 0, cardCount };
  });
}
