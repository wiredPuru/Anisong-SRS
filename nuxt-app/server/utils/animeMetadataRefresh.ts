import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { fetchAnimeFromAniListFresh, type AniListAnime } from "../lib/anilist.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { assertOnline } from "./networkMode.ts";

export interface AnimeMetadataRefreshResult {
  animeId: number;
  aniListId: number;
  refreshedAt: string;
}

export class AnimeMetadataRefreshError extends Error {
  readonly statusMessage: string;

  constructor(readonly statusCode: number, message: string) {
    super(message);
    this.statusMessage = message;
  }
}

export async function refreshAnimeMetadata(
  animeId: unknown,
  fetchAnime: (aniListId: number) => Promise<AniListAnime | null> = fetchAnimeFromAniListFresh,
): Promise<AnimeMetadataRefreshResult> {
  if (typeof animeId !== "number" || !Number.isSafeInteger(animeId) || animeId <= 0) {
    throw new AnimeMetadataRefreshError(400, "animeId must be a positive integer");
  }
  const stored = db.select().from(anime).where(eq(anime.id, animeId)).get();
  if (!stored) throw new AnimeMetadataRefreshError(404, "Saved anime not found");

  assertOnline();
  const fresh = await fetchAnime(stored.aniListId);
  if (!fresh) throw new AnimeMetadataRefreshError(404, "AniList no longer returns this anime");
  if (fresh.aniListId !== stored.aniListId || !fresh.details) throw new ProviderUnavailableError("AniList");

  const refreshedAt = new Date();
  const updated = db.update(anime).set({
    titleRomaji: fresh.titleRomaji,
    titleEnglish: fresh.titleEnglish ?? fresh.titleRomaji,
    titleNative: fresh.titleNative ?? fresh.titleRomaji,
    coverImageUrl: fresh.coverImageUrl,
    ...fresh.details,
    aniListDetailsCheckedAt: refreshedAt,
  }).where(and(eq(anime.id, animeId), eq(anime.aniListId, stored.aniListId))).returning({ id: anime.id }).get();
  if (!updated) throw new AnimeMetadataRefreshError(404, "Saved anime changed or was removed during refresh");

  return { animeId, aniListId: stored.aniListId, refreshedAt: refreshedAt.toISOString() };
}
