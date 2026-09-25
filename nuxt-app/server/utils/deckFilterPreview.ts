import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import { studyFilterCondition, type StudyFilters } from "./studyFilters.ts";

// Load-bearing for 77b, which keeps a hand-written client copy in the same
// field order.
export interface FilteredAnime {
  id: number;
  aniListId: number;
  titleEnglish: string;
  titleRomaji: string;
  titleNative: string;
  coverImageUrl: string | null;
  year: number | null;
  format: string | null;
  // Only cards matching the filters, so an OP/ED filter narrows it; building a
  // deck from these anime must add exactly the cards counted here.
  cardCount: number;
}

export interface FilteredAnimePreview {
  anime: FilteredAnime[];
  totalCards: number;
}

// Library anime only: the inner join on card drops anime with no cards, since
// picking one would add nothing to a deck.
export function listFilteredAnime(filters: StudyFilters | null): FilteredAnimePreview {
  const rows = db
    .select({
      id: anime.id,
      aniListId: anime.aniListId,
      titleEnglish: anime.titleEnglish,
      titleRomaji: anime.titleRomaji,
      titleNative: anime.titleNative,
      coverImageUrl: anime.coverImageUrl,
      year: anime.year,
      format: anime.format,
      cardCount: count(card.id),
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(studyFilterCondition(filters))
    .groupBy(anime.id)
    .orderBy(sql`${anime.titleRomaji} collate nocase`, asc(anime.id))
    .all();

  return { anime: rows, totalCards: rows.reduce((sum, row) => sum + row.cardCount, 0) };
}
