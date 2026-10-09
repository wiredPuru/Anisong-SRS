import type { PartyAnimeDetails } from "./partyLightning.ts";

export const CHOICE_COUNT = 4;
/** How many of the closest look-alikes the decoys are drawn from. */
const LOOKALIKE_POOL = 12;

export interface ChoiceCandidate {
  title: string;
  details: PartyAnimeDetails;
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Higher means more alike: shared genres and tags matter most, then format and air year. */
export function similarity(a: PartyAnimeDetails, b: PartyAnimeDetails): number {
  const genres = new Set(a.genres);
  const tags = new Set(a.tags.filter((tag) => tag.rank >= 50).map((tag) => tag.name));
  let score = 0;
  for (const genre of b.genres) if (genres.has(genre)) score += 3;
  for (const tag of b.tags) if (tag.rank >= 50 && tags.has(tag.name)) score += 2;
  if (a.format && a.format === b.format) score += 1;
  if (a.year && b.year) score += Math.max(0, 3 - Math.abs(a.year - b.year) / 3);
  return score;
}

/**
 * The right title plus decoys, in an order fixed per song. Decoys come from the
 * closest look-alikes, so the options are hard to tell apart; a correct answer
 * with no details falls back to random shows.
 */
export function pickChoices(
  correctTitle: string,
  correctDetails: PartyAnimeDetails,
  candidates: ChoiceCandidate[],
  seed: string,
  count = CHOICE_COUNT,
): string[] {
  const random = seededRandom(seed);
  const taken = new Set([correctTitle.toLowerCase()]);
  const unique = candidates.filter((candidate) => {
    const key = candidate.title.toLowerCase();
    if (!candidate.title || taken.has(key)) return false;
    taken.add(key);
    return true;
  });
  const hasClues = correctDetails.genres.length > 0 || correctDetails.tags.length > 0;
  const ranked = hasClues
    ? unique
        .map((candidate) => ({ candidate, score: similarity(correctDetails, candidate.details) }))
        .sort((x, y) => y.score - x.score)
        .slice(0, LOOKALIKE_POOL)
        .map(({ candidate }) => candidate)
    : unique;
  const decoys = shuffle(ranked, random).slice(0, count - 1).map((candidate) => candidate.title);
  return shuffle([correctTitle, ...decoys], random);
}
