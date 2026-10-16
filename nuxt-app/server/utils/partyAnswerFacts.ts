import type { PartyAnimeDetails } from "./partyLightning.ts";

/** Show facts the reveal card adds under the answer. */
export interface PartyAnswerFacts {
  year: number | null;
  season: string | null;
  format: string | null;
  studios: string[];
  averageScore: number | null;
  tags: string[];
}

export const EMPTY_ANSWER_FACTS: PartyAnswerFacts = { year: null, season: null, format: null, studios: [], averageScore: null, tags: [] };

// Matches the Study panel's quiet tag line: only tags AniList ranks as central.
const TAG_LIMIT = 3;
const MIN_TAG_RANK = 60;

/** The reveal's facts: the show's top tags, falling back to its genres when it has none. */
export function partyAnswerFacts(details: PartyAnimeDetails, studios: readonly string[]): PartyAnswerFacts {
  const tags = [...details.tags]
    .filter((tag) => tag.rank >= MIN_TAG_RANK)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, TAG_LIMIT)
    .map((tag) => tag.name);
  return {
    year: details.year,
    season: details.season,
    format: details.format,
    studios: [...studios],
    averageScore: details.averageScore,
    tags: tags.length ? tags : details.genres.slice(0, TAG_LIMIT),
  };
}
