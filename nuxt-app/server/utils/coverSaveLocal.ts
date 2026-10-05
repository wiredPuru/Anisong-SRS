import { and, count, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { ensureAnimeCoverLocal, type EnsureCoverResult } from "./animeCoverSave.ts";

export interface CoverSaveResult {
  checked: number;
  saved: number;
  failed: number;
}

// Shared by the count and the run so the number shown is the set that is saved.
const notSavedLocally = and(isNotNull(anime.coverImageUrl), isNull(anime.coverImagePath));

export function countAnimeCoversNotLocal(): number {
  return db.select({ count: count(anime.id) }).from(anime).where(notSavedLocally).get()!.count;
}

type EnsureCover = (animeId: number) => Promise<EnsureCoverResult>;

// Sequential on purpose, like the other backfills: one CDN, hundreds of files.
// A failure is counted and skipped, so a re-run picks up whatever was missed.
export async function saveCoversLocally(ensureCover: EnsureCover = ensureAnimeCoverLocal): Promise<CoverSaveResult> {
  const rows = db.select({ id: anime.id }).from(anime).where(notSavedLocally).all();

  let saved = 0;
  for (const row of rows) {
    if ((await ensureCover(row.id)) === "saved") saved += 1;
  }
  return { checked: rows.length, saved, failed: rows.length - saved };
}
