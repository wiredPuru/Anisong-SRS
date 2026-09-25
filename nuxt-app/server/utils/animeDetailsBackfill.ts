import { count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { ANILIST_DETAILS_BATCH_SIZE, type AniListDetails } from "../lib/anilist.ts";

export interface AnimeDetailsBackfillResult {
  checked: number;
  updated: number;
  skipped: number;
}

type DetailsFetcher = (aniListIds: number[]) => Promise<Map<number, AniListDetails>>;

// Same predicate as the backfill, so the count shown is the set it repairs.
export function countAnimeMissingDetails(): number {
  return db.select({ count: count(anime.id) }).from(anime).where(isNull(anime.aniListDetailsCheckedAt)).get()!.count;
}

// Saves after every batch, so an AniList outage partway through keeps the
// batches already fetched and a rerun resumes from the rows still unchecked.
export async function backfillAnimeDetails(fetchDetails: DetailsFetcher): Promise<AnimeDetailsBackfillResult> {
  const rows = db
    .select({ id: anime.id, aniListId: anime.aniListId })
    .from(anime)
    .where(isNull(anime.aniListDetailsCheckedAt))
    .all();

  let updated = 0;
  for (let start = 0; start < rows.length; start += ANILIST_DETAILS_BATCH_SIZE) {
    const batch = rows.slice(start, start + ANILIST_DETAILS_BATCH_SIZE);
    const found = await fetchDetails(batch.map((row) => row.aniListId));
    const checkedAt = new Date();
    db.transaction((tx) => {
      for (const row of batch) {
        const details = found.get(row.aniListId);
        if (!details) continue;
        tx.update(anime).set({ ...details, aniListDetailsCheckedAt: checkedAt }).where(eq(anime.id, row.id)).run();
        updated += 1;
      }
      // An id AniList does not return is stamped too, so it is never re-probed
      // and the missing count can reach zero.
      const missing = batch.filter((row) => !found.has(row.aniListId)).map((row) => row.id);
      if (missing.length) tx.update(anime).set({ aniListDetailsCheckedAt: checkedAt }).where(inArray(anime.id, missing)).run();
    });
  }

  return { checked: rows.length, updated, skipped: rows.length - updated };
}
