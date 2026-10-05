import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { searchSongsOnAnimeThemes } from "../lib/animethemes.ts";
import { searchSongs } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { type CardWithDetails, getCardWithDetails } from "./cards.ts";
import { filterClipUrls, isClipUrlAllowed } from "./clipSource.ts";
import { getClipSource, getIncludeInsertSongs } from "./mediaLibrary.ts";

export interface SourceCandidate {
  resultKey: string;
  provider: "anisongdb" | "animethemes";
  songTitle: string | null;
  artistName: string | null;
  themeSlot: string;
  animeTitle: string;
  sameAnime: boolean;
  videoUrl: string | null;
  audioUrl: string | null;
  clipBlocked: boolean;
}

type RawCandidate = Omit<SourceCandidate, "sameAnime" | "clipBlocked"> & { aniListId: number };

// Both providers are asked on purpose, unlike the add-card song search, which
// only falls back: a card that needs a new source is usually one the first
// provider already failed, so the second is the point of looking.
export async function searchSourceCandidates(query: string, animeAniListId: number | null): Promise<SourceCandidate[]> {
  const includeInserts = getIncludeInsertSongs();
  const [anisong, themes] = await Promise.allSettled([
    searchSongs(query, { includeInserts }),
    searchSongsOnAnimeThemes(query),
  ]);

  if (anisong.status === "rejected" && themes.status === "rejected") {
    const failure = anisong.reason instanceof ProviderUnavailableError ? anisong.reason : themes.reason;
    throw failure;
  }

  const clipSource = getClipSource();
  const entries: RawCandidate[] = [];

  if (anisong.status === "fulfilled") {
    for (const result of anisong.value) {
      entries.push({
        resultKey: `adb:${result.annSongId}`,
        provider: "anisongdb",
        songTitle: result.songTitle,
        artistName: result.artistName,
        themeSlot: result.themeSlot,
        animeTitle: result.animeTitleRomaji,
        aniListId: result.animeAniListId,
        videoUrl: result.videoUrl,
        audioUrl: result.audioUrl,
      });
    }
  }
  if (themes.status === "fulfilled") {
    for (const result of themes.value) {
      entries.push({
        resultKey: result.resultKey,
        provider: "animethemes",
        songTitle: result.songTitle,
        artistName: result.artistName,
        themeSlot: result.themeSlot,
        animeTitle: result.animeTitleRomaji,
        aniListId: result.animeAniListId,
        videoUrl: result.videoUrl,
        audioUrl: result.audioUrl,
      });
    }
  }

  const candidates = entries
    .filter((entry) => entry.videoUrl || entry.audioUrl)
    .map(({ aniListId, ...entry }): SourceCandidate => ({
      ...entry,
      sameAnime: animeAniListId !== null && aniListId === animeAniListId,
      ...filterClipUrls(entry.videoUrl, entry.audioUrl, clipSource),
    }));

  // Stable, so each provider's own relevance order survives inside a group.
  return candidates.sort((a, b) => Number(b.sameAnime) - Number(a.sameAnime));
}

export interface ApplySourceBody {
  cardId: number;
  videoUrl: string | null;
  audioUrl: string | null;
}

export function parseApplySourceBody(body: unknown): ApplySourceBody | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "cardId and a clip URL are required" };
  const { cardId, videoUrl, audioUrl } = body as Record<string, unknown>;

  if (typeof cardId !== "number" || !Number.isSafeInteger(cardId) || cardId <= 0) {
    return { error: "cardId must be a positive integer" };
  }
  for (const value of [videoUrl, audioUrl]) {
    if (value !== undefined && value !== null && (typeof value !== "string" || !value.trim())) {
      return { error: "videoUrl and audioUrl must be non-empty strings" };
    }
  }
  const video = typeof videoUrl === "string" ? videoUrl.trim() : null;
  const audio = typeof audioUrl === "string" ? audioUrl.trim() : null;
  if (!video && !audio) return { error: "videoUrl or audioUrl is required" };
  return { cardId, videoUrl: video, audioUrl: audio };
}

export type ApplySourceResult = { notFound: true } | { error: string } | { card: CardWithDetails };

// Replaces only the kinds the chosen result carries, so picking an audio-only
// result never wipes a working video URL. Local files are left alone: they
// still play, and clearing one deletes the file.
export function applyCardSource(input: ApplySourceBody): ApplySourceResult {
  const clipSource = getClipSource();
  for (const url of [input.videoUrl, input.audioUrl]) {
    if (url && !isClipUrlAllowed(url, clipSource)) {
      return { error: "The Clip source setting does not allow that source" };
    }
  }

  const values: { animethemesVideoUrl?: string; animethemesAudioUrl?: string } = {};
  if (input.videoUrl) values.animethemesVideoUrl = input.videoUrl;
  if (input.audioUrl) values.animethemesAudioUrl = input.audioUrl;

  const updated = db.update(card).set(values).where(eq(card.id, input.cardId)).returning({ id: card.id }).get();
  if (!updated) return { notFound: true };

  const refreshed = getCardWithDetails(input.cardId);
  return refreshed ? { card: refreshed } : { notFound: true };
}
