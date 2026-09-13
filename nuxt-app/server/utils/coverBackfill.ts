import { count, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import type { AniListAnime } from "../lib/anilist.ts";
import { setAnimeCoverImage } from "./lookup.ts";

export interface CoverBackfillResult {
  checked: number;
  updated: number;
  skipped: number;
}

type AniListFetcher = (aniListId: number) => Promise<AniListAnime | null>;

// Shares the isNull predicate with the backfill below on purpose: the count
// the user is shown and the set that actually gets repaired are the same rows.
export function countAnimeMissingCover(): number {
  return db.select({ count: count(anime.id) }).from(anime).where(isNull(anime.coverImageUrl)).get()!.count;
}

// Injected rather than imported so the tests can drive the outcomes (missing
// record, record with no cover, provider down) without stubbing global fetch.
export async function backfillMissingCovers(fetchAnime: AniListFetcher): Promise<CoverBackfillResult> {
  const rows = db
    .select({ id: anime.id, aniListId: anime.aniListId })
    .from(anime)
    .where(isNull(anime.coverImageUrl))
    .all();

  let updated = 0;
  for (const row of rows) {
    // Sequential on purpose: AniList rate limits, and this can run over every
    // anime imported during an outage, not just a handful.
    const fresh = await fetchAnime(row.aniListId);
    // Null covers both "AniList has no such anime" (a hand-made or test row
    // whose id does not resolve) and "it has one, but with no cover art".
    // Neither is a failure worth aborting a bulk repair for.
    if (!fresh?.coverImageUrl) continue;
    setAnimeCoverImage(row.id, fresh.coverImageUrl);
    updated += 1;
  }

  return { checked: rows.length, updated, skipped: rows.length - updated };
}
