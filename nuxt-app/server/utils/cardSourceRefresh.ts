import { and, eq, isNull, like, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { AnisongTheme } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { AnimeLookupUnavailableError } from "./animeMetadata.ts";
import type { ReportImportProgress } from "./importProgress.ts";
import { getClipSource } from "./mediaLibrary.ts";
import { titleKey } from "./textMatch.ts";

export interface SourceRefreshCandidate {
  cardId: number;
  animeId: number;
  aniListId: number;
  songTitle: string;
  themeSlot: string;
  swapVideo: boolean;
  swapAudio: boolean;
}

// Only an animethemes.moe URL is worth moving. An AMQ host is already the fast
// one, and a card with a local file for that kind never streams at all.
export function isAnimethemesUrl(url: string | null): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const { hostname } = parsed;
  return parsed.protocol === "https:" && (hostname === "animethemes.moe" || hostname.endsWith(".animethemes.moe"));
}

// The count the user is shown and the set that actually gets rewritten come
// from this one query, so they cannot disagree (the countAnimeMissingCover
// precedent). The SQL like() only narrows; isAnimethemesUrl below is what
// decides, since a substring match would also accept another host serving a
// path that happens to name animethemes.moe.
export function listSourceRefreshCandidates(): SourceRefreshCandidate[] {
  // This action's only write target is an AMQ host - under "animethemes"-only
  // mode that host is excluded, so moving a card onto it would break a card
  // that plays fine today rather than fix one that doesn't. Nothing to offer
  // in that mode; "anisongdb" and "both" both allow it, unchanged from today.
  if (getClipSource() === "animethemes") return [];

  const rows = db
    .select({
      cardId: card.id,
      localVideoPath: card.localVideoPath,
      localAudioPath: card.localAudioPath,
      animethemesVideoUrl: card.animethemesVideoUrl,
      animethemesAudioUrl: card.animethemesAudioUrl,
      songTitle: song.title,
      themeSlot: song.themeSlot,
      animeId: anime.id,
      aniListId: anime.aniListId,
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(
      or(
        and(isNull(card.localVideoPath), like(card.animethemesVideoUrl, "%animethemes.moe%")),
        and(isNull(card.localAudioPath), like(card.animethemesAudioUrl, "%animethemes.moe%")),
      ),
    )
    .all();

  return rows
    .map((row) => ({
      cardId: row.cardId,
      animeId: row.animeId,
      aniListId: row.aniListId,
      songTitle: row.songTitle,
      themeSlot: row.themeSlot,
      swapVideo: row.localVideoPath === null && isAnimethemesUrl(row.animethemesVideoUrl),
      swapAudio: row.localAudioPath === null && isAnimethemesUrl(row.animethemesAudioUrl),
    }))
    .filter((candidate) => candidate.swapVideo || candidate.swapAudio);
}

export function countCardsToRefresh(): number {
  return listSourceRefreshCandidates().length;
}

// The song title is the identity, never the theme slot: 60a measured the two
// providers disagreeing on 7 of 29 slots across a 12-anime probe, 2 of them
// genuinely different songs, so pairing by slot would leave a card titled one
// song and playing another. Slot is used only to break a tie between two
// AnisongDB themes that carry the same title. A stored title AnisongDB
// romanizes differently finds nothing and is left alone, which is the correct
// outcome rather than something to match more loosely.
export function matchTheme(candidate: SourceRefreshCandidate, themes: readonly AnisongTheme[]): AnisongTheme | null {
  const wanted = titleKey(candidate.songTitle);
  if (!wanted) return null;

  const matches = themes.filter((theme) => titleKey(theme.songTitle) === wanted);
  if (matches.length === 1) return matches[0]!;
  if (!matches.length) return null;

  const sameSlot = matches.filter((theme) => theme.themeSlot === candidate.themeSlot);
  return sameSlot.length === 1 ? sameSlot[0]! : null;
}

// AniList answers a 429 with a Retry-After and is currently enforcing 30
// requests a minute rather than its documented 90, which a library of any size
// exhausts in seconds. Waiting it out is what makes this one click instead of
// five. Bounded both ways so a provider that keeps asking for more time cannot
// stall a run indefinitely.
const MAX_RATE_LIMIT_WAITS = 10;
const MAX_WAIT_MS = 90_000;
const WAIT_TICK_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SourceRefreshResult {
  checked: number;
  updated: number;
  skipped: number;
  animeUnavailable: number;
}

// Injected rather than imported so the tests can drive every outcome without
// stubbing global fetch (the backfillMissingCovers precedent).
export interface SourceRefreshDeps {
  fetchAnime: (aniListId: number) => Promise<{ malId?: number | null } | null>;
  fetchThemes: (malId: number, aniListId: number) => Promise<AnisongTheme[]>;
}

export async function refreshCardSources(
  deps: SourceRefreshDeps,
  report: ReportImportProgress,
): Promise<SourceRefreshResult> {
  const candidates = listSourceRefreshCandidates();

  // One provider round trip per anime, not per card: every card under an anime
  // is answered by the same theme list.
  const byAnime = new Map<number, SourceRefreshCandidate[]>();
  for (const candidate of candidates) {
    byAnime.set(candidate.animeId, [...byAnime.get(candidate.animeId) ?? [], candidate]);
  }

  let completed = 0;
  let updated = 0;
  let animeUnavailable = 0;
  const reportProgress = (label = "Re-resolving clip sources") => report({
    label, completed, total: byAnime.size, unavailable: animeUnavailable,
  });
  reportProgress();

  let waitsLeft = MAX_RATE_LIMIT_WAITS;

  // Only a timed refusal is worth waiting on: a provider that is simply down
  // sends no Retry-After, and sleeping on that stalls the run to learn nothing.
  async function fetchAnimeWaitingOutRateLimits(aniListId: number) {
    try {
      return await deps.fetchAnime(aniListId);
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError) || !error.retryAfterMs || !waitsLeft) throw error;
      waitsLeft -= 1;

      // Ticked rather than slept in one go: the progress readout calls itself
      // stalled after 15 seconds with no event, and this is a minute of
      // deliberate silence.
      const waitMs = Math.min(error.retryAfterMs, MAX_WAIT_MS);
      for (let waited = 0; waited < waitMs; waited += WAIT_TICK_MS) {
        reportProgress("Waiting out AniList's rate limit");
        await sleep(Math.min(WAIT_TICK_MS, waitMs - waited));
      }
      return await deps.fetchAnime(aniListId);
    }
  }

  for (const group of byAnime.values()) {
    const { aniListId } = group[0]!;
    try {
      let record;
      try {
        // Only AniList carries the MAL id AnisongDB is keyed on, so one anime
        // failing here costs that anime and nothing more.
        record = await fetchAnimeWaitingOutRateLimits(aniListId);
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) throw error;
        animeUnavailable += 1;
        continue;
      }
      if (!record?.malId) continue;

      // Deliberately not caught: AnisongDB is the only source of a faster URL,
      // so an outage here cannot be degraded around, and continuing would spend
      // an AniList call per remaining anime to learn the same thing again.
      const themes = await deps.fetchThemes(record.malId, aniListId);

      for (const candidate of group) {
        const match = matchTheme(candidate, themes);
        if (!match) continue;

        const values: { animethemesVideoUrl?: string; animethemesAudioUrl?: string } = {};
        if (candidate.swapVideo && match.videoUrl) values.animethemesVideoUrl = match.videoUrl;
        if (candidate.swapAudio && match.audioUrl) values.animethemesAudioUrl = match.audioUrl;
        if (!Object.keys(values).length) continue;

        db.update(card).set(values).where(eq(card.id, candidate.cardId)).run();
        updated += 1;
      }
    } finally {
      completed += 1;
      reportProgress();
    }
  }

  // Nothing moved and something was unreachable: report it as the outage it is
  // rather than as a successful no-op the user would read as "already done".
  if (!updated && animeUnavailable) throw new AnimeLookupUnavailableError();

  return { checked: candidates.length, updated, skipped: candidates.length - updated, animeUnavailable };
}
