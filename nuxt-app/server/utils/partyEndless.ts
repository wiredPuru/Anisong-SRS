export const ENDLESS_DIFFICULTIES = ["easy", "medium", "hard", "random"] as const;
export type EndlessDifficulty = (typeof ENDLESS_DIFFICULTIES)[number];

/** Songs still to come that the endless queue keeps ready, and how many it adds at a time. */
export const ENDLESS_AHEAD = 4;
export const ENDLESS_BATCH = 10;

const EASY_MIN_SCORE = 75;
const MEDIUM_MIN_SCORE = 60;
const MAX_WINDOW = 60;

export interface EndlessCandidate {
  cardId: number;
  animeId: number;
  score: number | null;
  /** Has a local video or audio file. */
  downloaded: boolean;
}

/** A well-rated show is likely a familiar one; an unrated or low-rated one is a deep cut. */
export function difficultyOf(score: number | null): Exclude<EndlessDifficulty, "random"> {
  if (score === null) return "hard";
  if (score >= EASY_MIN_SCORE) return "easy";
  return score >= MEDIUM_MIN_SCORE ? "medium" : "hard";
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
  random?: () => number;
}): number[] {
  const { difficulty, queue, count } = options;
  const random = options.random ?? Math.random;
  const candidates = options.downloadedOnly ? options.candidates.filter((candidate) => candidate.downloaded) : options.candidates;
  const band = difficulty === "random" ? candidates : candidates.filter((candidate) => difficultyOf(candidate.score) === difficulty);
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
  const picked: number[] = [];
  for (const candidate of shuffled(pool, random)) {
    if (picked.length >= count) break;
    if (queued.has(candidate.cardId) || recentShows.has(candidate.animeId)) continue;
    picked.push(candidate.cardId);
    recentShows.add(candidate.animeId);
  }
  return picked;
}
