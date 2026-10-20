export const ENDLESS_DIFFICULTIES = ["easy", "medium", "hard", "random"] as const;
export type EndlessDifficulty = (typeof ENDLESS_DIFFICULTIES)[number];

/** Songs still to come that the endless queue keeps ready, and how many it adds at a time. */
export const ENDLESS_AHEAD = 4;
export const ENDLESS_BATCH = 10;

const MAX_WINDOW = 60;

/**
 * AnisongDB songDifficulty bands for songs outside the library. The value is
 * AMQ's guess rate, so higher is easier; about 31% of the catalog is 30+ and
 * 8% is 50+, which is why Easy is the narrow band. Random has no range.
 */
export function catalogDifficultyRange(difficulty: EndlessDifficulty): { start: number; end: number } | null {
  if (difficulty === "easy") return { start: 50, end: 100 };
  if (difficulty === "medium") return { start: 30, end: 50 };
  if (difficulty === "hard") return { start: 0, end: 30 };
  return null;
}

/** AniList popularity (users listing a show) at the 500th and 1000th most popular anime. */
export interface PopularityCutoffs {
  top500: number;
  top1000: number;
}

/** Stand-ins until AniList's real cutoffs load; they only need to be roughly right. */
export const DEFAULT_CUTOFFS: PopularityCutoffs = { top500: 90_000, top1000: 55_000 };

/** The share of each difficulty's songs drawn from anywhere, for a little spice. */
const WILD_SHARE: Record<EndlessDifficulty, number> = { easy: 0.1, medium: 0.1, hard: 0.25, random: 0 };

export interface EndlessCandidate {
  cardId: number;
  animeId: number;
  /** AniList popularity, null until the Settings AniList backfill has run. */
  popularity: number | null;
  /** Has a local video or audio file. */
  downloaded: boolean;
}

/**
 * Easy is the top 500 anime, medium the top 1000, hard everything outside the
 * top 500 (an unknown popularity counts as outside), random is any.
 */
export function inBand(difficulty: EndlessDifficulty, popularity: number | null, cutoffs: PopularityCutoffs): boolean {
  if (difficulty === "random") return true;
  if (difficulty === "easy") return popularity !== null && popularity >= cutoffs.top500;
  if (difficulty === "medium") return popularity !== null && popularity >= cutoffs.top1000;
  return popularity === null || popularity < cutoffs.top500;
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
 * The next songs for an endless queue: from the chosen difficulty (the whole
 * library for Random, or when that band is empty), never a song already queued, and no show
 * that appeared in the last stretch of the queue. The stretch is most of the
 * band's shows, so a show waits a good while before coming back, and a small
 * band simply gets a shorter wait. At most one song per show per batch.
 */
export function pickEndlessBatch(options: {
  candidates: EndlessCandidate[];
  difficulty: EndlessDifficulty;
  /** Only songs with a local file; otherwise streamed songs count too. */
  downloadedOnly?: boolean;
  queue: number[];
  count: number;
  cutoffs?: PopularityCutoffs;
  random?: () => number;
}): number[] {
  const { difficulty, queue, count } = options;
  const random = options.random ?? Math.random;
  const candidates = options.downloadedOnly ? options.candidates.filter((candidate) => candidate.downloaded) : options.candidates;
  const cutoffs = options.cutoffs ?? DEFAULT_CUTOFFS;
  const band = candidates.filter((candidate) => inBand(difficulty, candidate.popularity, cutoffs));
  const pool = band.length ? band : candidates;

  const animeOf = new Map(candidates.map((candidate) => [candidate.cardId, candidate.animeId]));
  const showCount = new Set(pool.map((candidate) => candidate.animeId)).size;
  const window = Math.max(1, Math.min(MAX_WINDOW, Math.floor(showCount * 0.7)));
  const recentShows = new Set<number>();
  for (const cardId of queue.slice(-window)) {
    const animeId = animeOf.get(cardId);
    if (animeId !== undefined) recentShows.add(animeId);
  }

  const queued = new Set(queue);
  const main = shuffled(pool, random);
  const wild = shuffled(candidates, random);
  const picked: number[] = [];
  const usable = (candidate: EndlessCandidate) => !queued.has(candidate.cardId) && !recentShows.has(candidate.animeId) && !picked.includes(candidate.cardId);
  while (picked.length < count) {
    const lists = random() < WILD_SHARE[difficulty] ? [wild, main] : [main, wild];
    const next = lists.map((list) => list.find(usable)).find((candidate) => candidate !== undefined);
    if (!next) break;
    picked.push(next.cardId);
    recentShows.add(next.animeId);
  }
  return picked;
}
