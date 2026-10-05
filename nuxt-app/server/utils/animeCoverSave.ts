import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { MAX_ANIME_COVER_BYTES, resolveAnimeCover, saveAnimeCover } from "./animeCoverStore.ts";
import { USER_AGENT } from "./version.ts";

const COVER_TIMEOUT_MS = 15_000;

export type FetchCoverImage = (url: string) => Promise<Uint8Array | null>;
export type EnsureCoverResult = "saved" | "already-local" | "no-cover" | "failed";

export const fetchCoverImage: FetchCoverImage = async (url) => {
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(COVER_TIMEOUT_MS) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > MAX_ANIME_COVER_BYTES ? null : bytes;
  } catch {
    return null;
  }
};

// Never throws: a cover that cannot be saved just stays on its AniList URL, and
// must not fail the import or backfill that asked. An anime that already has a
// file is left alone, even if AniList has since changed its cover art.
export async function ensureAnimeCoverLocal(
  animeId: number,
  fetchImage: FetchCoverImage = fetchCoverImage,
): Promise<EnsureCoverResult> {
  try {
    const row = db.select({ coverImageUrl: anime.coverImageUrl }).from(anime).where(eq(anime.id, animeId)).get();
    if (!row?.coverImageUrl) return "no-cover";
    if (resolveAnimeCover(animeId)?.kind === "file") return "already-local";

    const bytes = await fetchImage(row.coverImageUrl);
    if (!bytes) return "failed";
    return "fileName" in saveAnimeCover(animeId, bytes) ? "saved" : "failed";
  } catch {
    return "failed";
  }
}

// Imports answer as soon as the cards exist; the cover lands a moment later.
export function saveAnimeCoverInBackground(animeId: number): void {
  void ensureAnimeCoverLocal(animeId);
}
