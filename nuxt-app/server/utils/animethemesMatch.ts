import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { ReportImportProgress } from "./importProgress.ts";
import { findThemeMatch, startMatchIndexLoads, type AnimeThemesMatchIndex } from "./themeSource.ts";

export interface MatchCandidate {
  songId: number;
  aniListId: number;
  songTitle: string;
}

export interface MatchBackfillResult {
  checked: number;
  matched: number;
  missing: number;
  unavailable: number;
}

// A null animethemesThemeId means "AnimeThemes does not have this song" only
// once something has actually looked. The lookup arrived with feature 70b, so
// every song imported before it is unknown, not absent - and the themes-only
// study filter reads the two the same way. checkedAt is what separates them.
const uncheckedCondition = and(isNull(song.animethemesThemeId), isNull(song.animethemesCheckedAt));

// Only songs backing a card: the filters this repairs are about cards, and an
// orphaned song row (feature 61's kept metadata cache) is not worth a lookup.
export function countUncheckedSongs(): number {
  return db
    .select({ count: count(song.id) })
    .from(song)
    .innerJoin(card, eq(card.songId, song.id))
    .where(uncheckedCondition)
    .get()!.count;
}

export function listMatchCandidates(): MatchCandidate[] {
  const rows = db
    .selectDistinct({ songId: song.id, aniListId: anime.aniListId, songTitle: song.title })
    .from(song)
    .innerJoin(card, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(uncheckedCondition)
    .all();
  return rows;
}

export function storeMatchResult(songId: number, themeId: number | null, checkedAt: Date): void {
  db.update(song)
    .set({ animethemesThemeId: themeId, animethemesCheckedAt: checkedAt })
    .where(eq(song.id, songId))
    .run();
}

type IndexLoader = (aniListIds: number[]) => Map<number, Promise<AnimeThemesMatchIndex>>;
type StoreMatch = (songId: number, themeId: number | null, checkedAt: Date) => void;

// Injected the same way backfillMissingCovers takes its fetcher, so the tests
// can drive a match, a genuine miss, and an outage without stubbing fetch.
export async function backfillAnimeThemesMatches(
  candidates: readonly MatchCandidate[],
  {
    loadIndexes = startMatchIndexLoads,
    store = storeMatchResult,
    report,
    now = () => new Date(),
  }: { loadIndexes?: IndexLoader; store?: StoreMatch; report?: ReportImportProgress; now?: () => Date } = {},
): Promise<MatchBackfillResult> {
  const loads = loadIndexes(candidates.map((candidate) => candidate.aniListId));
  const result: MatchBackfillResult = { checked: candidates.length, matched: 0, missing: 0, unavailable: 0 };

  let completed = 0;
  for (const candidate of candidates) {
    const index = await loads.get(candidate.aniListId)!;

    // An outage cannot tell "no match" from "could not check", so the row is
    // left unstamped and stays a candidate for the next run - the same
    // fail-open call isMissingAnimeThemesMatch already makes at import time.
    if (index.status === "unavailable") {
      result.unavailable += 1;
    } else {
      const themeId = findThemeMatch(index, candidate.songTitle);
      store(candidate.songId, themeId, now());
      if (themeId === null) result.missing += 1;
      else result.matched += 1;
    }

    completed += 1;
    report?.({ label: "Checking songs against AnimeThemes.moe", completed, total: candidates.length });
  }

  return result;
}
