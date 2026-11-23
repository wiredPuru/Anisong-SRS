/** AniList global popularity: the top 500, 501-1000, or everything else. */
export type RankBand = "top500" | "top1000" | "rest";
/** AMQ guess rate: 50+, 30-50 (plus unrated songs), under 30. */
export type GuessColumn = "high" | "mid" | "low";
export type GridTier = "veryEasy" | "easy" | "medium" | "hard";

export interface GridCell {
  band: RankBand;
  column: GuessColumn;
}

export interface RankedAnime {
  aniListId: number;
  malId: number | null;
  /** 1 is the most popular. */
  rank: number;
}

export const TIER_CELLS: Record<GridTier, GridCell[]> = {
  veryEasy: [{ band: "top500", column: "high" }],
  easy: [
    { band: "top500", column: "mid" },
    { band: "top1000", column: "high" },
  ],
  medium: [
    { band: "top500", column: "low" },
    { band: "top1000", column: "mid" },
    { band: "rest", column: "high" },
  ],
  hard: [
    { band: "top1000", column: "low" },
    { band: "rest", column: "mid" },
    { band: "rest", column: "low" },
  ],
};

/** The songDifficulty range of a column; ranges stop short of the next one so none overlap. */
export function columnRange(column: GuessColumn): { start: number; end: number; includeUnrated: boolean } {
  if (column === "high") return { start: 50, end: 100, includeUnrated: false };
  if (column === "mid") return { start: 30, end: 49.9, includeUnrated: true };
  return { start: 0, end: 29.9, includeUnrated: false };
}

/** AniList id to rank, for band lookups. */
export function rankIndex(ranking: RankedAnime[]): Map<number, number> {
  return new Map(ranking.map((anime) => [anime.aniListId, anime.rank]));
}

export function rankBand(aniListId: number | null, ranks: ReadonlyMap<number, number>): RankBand {
  const rank = aniListId === null ? undefined : ranks.get(aniListId);
  if (rank === undefined) return "rest";
  if (rank <= 500) return "top500";
  return rank <= 1000 ? "top1000" : "rest";
}

/** MAL ids of a ranked band; shows AniList has no MAL id for cannot be asked about. */
export function bandMalIds(ranking: RankedAnime[], band: Exclude<RankBand, "rest">): number[] {
  const [low, high] = band === "top500" ? [1, 500] : [501, 1000];
  return ranking
    .filter((anime) => anime.rank >= low && anime.rank <= high && anime.malId !== null)
    .map((anime) => anime.malId!);
}

export interface PoolSong {
  annSongId: number;
  aniListId: number | null;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Up to `count` songs from a pool, one per show, never one already queued and
 * no recently used show. When that leaves too few, recent shows come back
 * oldest first. A song with no AniList id is a show of its own.
 */
export function drawFromPool<T extends PoolSong>(
  pool: T[],
  options: { queued: ReadonlySet<number>; recentShows: readonly number[]; count: number; random?: () => number },
): T[] {
  const random = options.random ?? Math.random;
  const candidates = shuffled(pool.filter((song) => !options.queued.has(song.annSongId)), random);
  const recent = new Set(options.recentShows);
  const usedShows = new Set<number>();
  const picked: T[] = [];
  const take = (song: T) => {
    picked.push(song);
    if (song.aniListId !== null) usedShows.add(song.aniListId);
  };

  for (const song of candidates) {
    if (picked.length >= options.count) return picked;
    if (song.aniListId === null) take(song);
    else if (!recent.has(song.aniListId) && !usedShows.has(song.aniListId)) take(song);
  }
  for (const show of options.recentShows) {
    if (picked.length >= options.count) break;
    if (usedShows.has(show)) continue;
    const song = candidates.find((candidate) => candidate.aniListId === show);
    if (song) take(song);
  }
  return picked;
}
