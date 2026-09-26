import { and, asc, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, deck, deckCard, song } from "../db/schema.ts";
import { parseStudyFilters, studyFilterCondition, type StudyFilters } from "./studyFilters.ts";

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

// Matches the library's anime count bound on a user-list filter.
export const COPY_FILTERED_ANIME_MAX = 5000;

export interface CopyFilteredBody {
  deckId: number;
  animeIds: number[];
  filters: StudyFilters | null;
}

export type CopyFilteredResult = { notFound: true } | { added: number; alreadyInDeck: number };

function isRowId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function parseCopyFilteredBody(body: unknown): CopyFilteredBody | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "deckId and animeIds are required" };
  }
  const { deckId, animeIds, filters } = body as { deckId?: unknown; animeIds?: unknown; filters?: unknown };

  if (!isRowId(deckId)) return { error: "deckId must be a positive integer" };
  if (!Array.isArray(animeIds) || animeIds.length === 0) return { error: "animeIds must be a non-empty array" };
  if (!animeIds.every(isRowId)) return { error: "animeIds must all be positive integers" };
  const unique = [...new Set(animeIds)];
  if (unique.length > COPY_FILTERED_ANIME_MAX) {
    return { error: `animeIds may hold at most ${COPY_FILTERED_ANIME_MAX} entries` };
  }

  const parsed = parseStudyFilters(filters);
  if ("error" in parsed) return { error: parsed.error };
  return { deckId, animeIds: unique, filters: parsed.filters };
}

/** Links the picked anime's filter-matching cards into a manual deck, as a one-time snapshot. */
export function copyFilteredCards(deckId: number, animeIds: readonly number[], filters: StudyFilters | null): CopyFilteredResult {
  const deckExists = db.select({ id: deck.id }).from(deck).where(eq(deck.id, deckId)).get();
  if (!deckExists) return { notFound: true };

  // Same join and condition as listFilteredAnime, so this adds exactly the
  // cards the preview counted for these anime.
  const condition: SQL = and(studyFilterCondition(filters), inArray(anime.id, [...animeIds]))!;

  return db.transaction(() => {
    const matching = db
      .select({ n: count(card.id) })
      .from(card)
      .innerJoin(song, eq(card.songId, song.id))
      .innerJoin(anime, eq(song.animeId, anime.id))
      .where(condition)
      .get()!.n;
    // The WHERE clause is always present, which SQLite needs to parse
    // INSERT ... SELECT ... ON CONFLICT without mistaking ON for a join.
    const { changes } = db.run(
      sql`insert into ${deckCard} (${sql.identifier(deckCard.deckId.name)}, ${sql.identifier(deckCard.cardId.name)})
          select ${deckId}, ${card.id} from ${card}
          inner join ${song} on ${card.songId} = ${song.id}
          inner join ${anime} on ${song.animeId} = ${anime.id}
          where ${condition}
          on conflict do nothing`,
    );
    return { added: changes, alreadyInDeck: matching - changes };
  });
}
