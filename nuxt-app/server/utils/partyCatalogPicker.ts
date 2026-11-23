import type { AnimeSeason } from "../lib/anilist.ts";
import { fetchRandomSongs, fetchSongsByMalIds, type AnisongRandomSong } from "../lib/anisongdb.ts";
import { matchesSeasons, type AnisongSongFilterOptions } from "./partyCatalogFilters.ts";
import { bandMalIds, columnRange, drawFromPool, rankBand, rankIndex, TIER_CELLS, type GridCell, type RankedAnime } from "./partyCatalogGrid.ts";
import { catalogDifficultyRange, type EndlessDifficulty } from "./partyEndless.ts";
import { rankingWithin } from "./popularityRanking.ts";

const POOL_TTL_MS = 30 * 60 * 1000;
const RECENT_SHOWS = 60;
const RANKING_WAIT_MS = 3000;

export interface CatalogPickRequest {
  tier: EndlessDifficulty;
  options: AnisongSongFilterOptions;
  /** Seasons to check song by song; null when the request's range covers them. */
  seasons: AnimeSeason[] | null;
  /** AMQ song ids already in the queue. */
  queued: ReadonlySet<number>;
  count: number;
  random?: () => number;
}

export interface CatalogPick {
  songs: AnisongRandomSong[];
  /** AnisongDB had no songs at all for any of the tier's cells. */
  noMatch: boolean;
  /** The popularity ranking shaped this pick; false for Random and the guess-rate fallback. */
  usedRanking: boolean;
}

// A whole rank band's songs for one cell and filter set, fetched once and drawn from locally.
const pools = new Map<string, { songs: AnisongRandomSong[]; fetchedAt: number }>();
// AniList ids of shows the catalog endless queue added, oldest first.
let recentShows: number[] = [];

/** Forgets pools and recent shows; every endless command starts afresh. */
export function resetCatalogPicker(): void {
  pools.clear();
  recentShows = [];
}

/** Remembers the shows of songs that made it into the queue. */
export function noteCatalogShows(songs: AnisongRandomSong[]): void {
  const ids = songs.map((song) => song.aniListId).filter((id): id is number => id !== null);
  recentShows = [...recentShows.filter((id) => !ids.includes(id)), ...ids].slice(-RECENT_SHOWS);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

async function bandPool(cell: GridCell, ranking: RankedAnime[], options: AnisongSongFilterOptions, now: number): Promise<AnisongRandomSong[]> {
  const key = `${cell.band}/${cell.column}/${JSON.stringify(options)}`;
  const cached = pools.get(key);
  if (cached && now - cached.fetchedAt < POOL_TTL_MS) return cached.songs;
  const band = cell.band === "top500" ? "top500" : "top1000";
  const songs = await fetchSongsByMalIds(bandMalIds(ranking, band), columnRange(cell.column), options);
  pools.set(key, { songs, fetchedAt: now });
  return songs;
}

/**
 * The next catalog songs for an endless tier. Each tier is a set of popularity
 * x guess-rate cells; one is tried at random, then the others. Without the
 * ranking (still loading, or AniList down) a tier uses its guess rate alone.
 */
export async function pickCatalogSongs(request: CatalogPickRequest, now = Date.now()): Promise<CatalogPick> {
  const { tier, options, seasons, queued, count } = request;
  const random = request.random ?? Math.random;
  const draw = (songs: AnisongRandomSong[]) =>
    drawFromPool(
      songs.filter((song) => matchesSeasons(song.animeVintage, seasons)),
      { queued, recentShows, count, random },
    );
  const ask = count * (seasons ? 8 : 4);

  const ranking = tier === "random" ? null : await rankingWithin(RANKING_WAIT_MS);
  if (tier === "random" || !ranking) {
    const songs = await fetchRandomSongs(ask, catalogDifficultyRange(tier), options);
    return { songs: draw(songs), noMatch: !songs.length, usedRanking: false };
  }

  const ranks = rankIndex(ranking);
  let anyFound = false;
  for (const cell of shuffled(TIER_CELLS[tier], random)) {
    const songs = cell.band === "rest" ? await fetchRandomSongs(ask, columnRange(cell.column), options) : await bandPool(cell, ranking, options, now);
    // A random draw that happened to land only on top-1000 shows still means the cell has songs.
    if (songs.length) anyFound = true;
    const picked = draw(cell.band === "rest" ? songs.filter((song) => rankBand(song.aniListId, ranks) === "rest") : songs);
    if (picked.length) return { songs: picked, noMatch: false, usedRanking: true };
  }
  return { songs: [], noMatch: !anyFound, usedRanking: true };
}
