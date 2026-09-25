import { and, count, eq, exists, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { ReportImportProgress } from "./importProgress.ts";
import { setAnimeAnimethemesSlug } from "./lookup.ts";
import { startMatchIndexLoads, type AnimeThemesMatchIndex } from "./themeSource.ts";

export interface LinkCandidate {
  animeId: number;
  aniListId: number;
}

export interface LinkBackfillResult {
  checked: number;
  filled: number;
  notFound: number;
  unavailable: number;
}

// Only anime AnimeThemes is already known to have: one with a null
// animethemesId is the match backfill's to settle, not this one's.
const songMissingVideoSlug = db
  .select({ id: song.id })
  .from(song)
  .innerJoin(card, eq(card.songId, song.id))
  .where(and(eq(song.animeId, anime.id), isNotNull(song.animethemesThemeId), isNull(song.animethemesVideoSlug)));

const candidateCondition = and(
  isNotNull(anime.animethemesId),
  exists(db.select({ id: card.id }).from(card).innerJoin(song, eq(card.songId, song.id)).where(eq(song.animeId, anime.id))),
  or(isNull(anime.animethemesSlug), exists(songMissingVideoSlug)),
);

export function countAnimeMissingLinks(): number {
  return db.select({ count: count(anime.id) }).from(anime).where(candidateCondition).get()!.count;
}

export function listLinkCandidates(): LinkCandidate[] {
  return db.select({ animeId: anime.id, aniListId: anime.aniListId }).from(anime).where(candidateCondition).all();
}

type OkIndex = Extract<AnimeThemesMatchIndex, { status: "ok" }>;

// Refreshes a song's slug even if one is stored: AnimeThemes' current answer
// is the one that names a page that still exists.
export function storeAnimeLinks(candidate: LinkCandidate, index: OkIndex): void {
  setAnimeAnimethemesSlug(candidate.animeId, index.animethemesSlug);
  for (const [themeId, animethemesVideoSlug] of index.videoSlugByThemeId) {
    db.update(song)
      .set({ animethemesVideoSlug })
      .where(and(eq(song.animeId, candidate.animeId), eq(song.animethemesThemeId, themeId)))
      .run();
  }
}

type IndexLoader = (aniListIds: number[]) => Map<number, Promise<AnimeThemesMatchIndex>>;
type StoreLinks = (candidate: LinkCandidate, index: OkIndex) => void;

export async function backfillAnimeThemesLinks(
  candidates: readonly LinkCandidate[],
  {
    loadIndexes = startMatchIndexLoads,
    store = storeAnimeLinks,
    report,
  }: { loadIndexes?: IndexLoader; store?: StoreLinks; report?: ReportImportProgress } = {},
): Promise<LinkBackfillResult> {
  const loads = loadIndexes(candidates.map((candidate) => candidate.aniListId));
  const result: LinkBackfillResult = { checked: candidates.length, filled: 0, notFound: 0, unavailable: 0 };

  let completed = 0;
  for (const candidate of candidates) {
    const index = await loads.get(candidate.aniListId)!;

    // Nothing is written on an outage, so the anime stays a candidate and the
    // next run asks again.
    if (index.status === "unavailable") {
      result.unavailable += 1;
    } else if (index.animethemesId === null) {
      result.notFound += 1;
    } else {
      store(candidate, index);
      result.filled += 1;
    }

    completed += 1;
    report?.({ label: "Fetching AnimeThemes.moe links", completed, total: candidates.length });
  }

  return result;
}
