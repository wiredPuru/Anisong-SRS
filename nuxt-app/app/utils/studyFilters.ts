export type StudyThemeType = "OP" | "ED" | "IN";
export type StudySeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";
const STUDY_SEASONS: readonly string[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
export type StudyListSite = "anilist" | "mal";

export interface StudyListSource {
  site: StudyListSite;
  username: string;
  fetchedAt: string;
}

// Hand-kept copy of the server's StudyFilters (server/utils/studyFilters.ts),
// same field order.
export interface StudyFilters {
  yearMin: number | null;
  yearMax: number | null;
  seasons: StudySeason[];
  scoreMin: number | null;
  scoreMax: number | null;
  formats: string[];
  themeTypes: StudyThemeType[];
  genresInclude: string[];
  genresExclude: string[];
  tagsInclude: string[];
  tagsExclude: string[];
  tagMinRank: number;
  listAniListIds: number[] | null;
  listSource: StudyListSource | null;
}

export const STUDY_FILTERS_STORAGE_KEY = "gaqSrs:studyFilters";

export const EMPTY_STUDY_FILTERS: StudyFilters = {
  yearMin: null,
  yearMax: null,
  seasons: [],
  scoreMin: null,
  scoreMax: null,
  formats: [],
  themeTypes: [],
  genresInclude: [],
  genresExclude: [],
  tagsInclude: [],
  tagsExclude: [],
  tagMinRank: 60,
  listAniListIds: null,
  listSource: null,
};

export const ANIME_FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

// Each bound pair, list-type choice, and genre or tag counts as one filter,
// which is what the Filters badge shows.
export function countActiveFilters(filters: StudyFilters): number {
  return Number(filters.yearMin !== null || filters.yearMax !== null)
    + Number(filters.seasons.length > 0)
    + Number(filters.scoreMin !== null || filters.scoreMax !== null)
    + Number(filters.formats.length > 0)
    + Number(filters.themeTypes.length > 0)
    + filters.genresInclude.length + filters.genresExclude.length
    + filters.tagsInclude.length + filters.tagsExclude.length
    + Number(filters.listAniListIds !== null);
}

export function filtersQueryValue(filters: StudyFilters): string | undefined {
  return countActiveFilters(filters) ? JSON.stringify(filters) : undefined;
}

// Why a draft cannot be applied, or null when it can. The server rejects the
// same cases with a 400, which would otherwise stall every Study fetch.
export function studyFiltersProblem(filters: StudyFilters): string | null {
  const bounds: [number | null, number, number][] = [
    [filters.yearMin, 1900, 2100], [filters.yearMax, 1900, 2100],
    [filters.scoreMin, 0, 100], [filters.scoreMax, 0, 100], [filters.tagMinRank, 0, 100],
  ];
  if (bounds.some(([value, min, max]) => value !== null && (!Number.isInteger(value) || value < min || value > max))) {
    return "Years run from 1900 to 2100, and scores and relevance from 0 to 100.";
  }
  if (filters.yearMin !== null && filters.yearMax !== null && filters.yearMin > filters.yearMax) {
    return "The start year is after the end year.";
  }
  if (filters.scoreMin !== null && filters.scoreMax !== null && filters.scoreMin > filters.scoreMax) {
    return "The minimum score is above the maximum.";
  }
  return null;
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim() !== "");
const isBound = (value: unknown): value is number | null => value === null || typeof value === "number";

function listFieldsValid(ids: unknown, source: unknown): boolean {
  if (ids === null && source === null) return true;
  if (!Array.isArray(ids) || !ids.every((id) => Number.isSafeInteger(id) && id > 0)) return false;
  if (typeof source !== "object" || source === null) return false;
  const { site, username, fetchedAt } = source as Record<string, unknown>;
  return (site === "anilist" || site === "mal") && typeof username === "string" && username.trim() !== ""
    && typeof fetchedAt === "string";
}

// Anything unreadable or no longer valid falls back to no filters rather than
// a stored value the server would reject on every request.
export function readStoredFilters(raw: string | null): StudyFilters {
  if (!raw) return { ...EMPTY_STUDY_FILTERS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_STUDY_FILTERS };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ...EMPTY_STUDY_FILTERS };
  const stored = { ...EMPTY_STUDY_FILTERS, ...(parsed as Partial<StudyFilters>) };
  const listsValid = [stored.seasons, stored.formats, stored.themeTypes, stored.genresInclude, stored.genresExclude, stored.tagsInclude, stored.tagsExclude]
    .every(isStringList) && stored.themeTypes.every((type) => type === "OP" || type === "ED" || type === "IN")
    && stored.seasons.every((season) => STUDY_SEASONS.includes(season));
  const boundsValid = [stored.yearMin, stored.yearMax, stored.scoreMin, stored.scoreMax].every(isBound)
    && typeof stored.tagMinRank === "number";
  if (!listsValid || !boundsValid || !listFieldsValid(stored.listAniListIds, stored.listSource) || studyFiltersProblem(stored)) {
    return { ...EMPTY_STUDY_FILTERS };
  }
  return {
    yearMin: stored.yearMin,
    yearMax: stored.yearMax,
    seasons: stored.seasons,
    scoreMin: stored.scoreMin,
    scoreMax: stored.scoreMax,
    formats: stored.formats,
    themeTypes: stored.themeTypes,
    genresInclude: stored.genresInclude,
    genresExclude: stored.genresExclude,
    tagsInclude: stored.tagsInclude,
    tagsExclude: stored.tagsExclude,
    tagMinRank: stored.tagMinRank,
    listAniListIds: stored.listAniListIds,
    listSource: stored.listSource,
  };
}

export interface TagOption {
  name: string;
  ranks: number[];
}

// Counts shows at the filter's own relevance cutoff, since a show below it
// would never match. Most shared first.
export function countTags(tags: TagOption[], minRank: number, chosen: ReadonlySet<string>): { name: string; count: number }[] {
  return tags
    .filter((tag) => !chosen.has(tag.name))
    .map((tag) => ({ name: tag.name, count: tag.ranks.filter((rank) => rank >= minRank).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function tagBreakdown(tags: TagOption[], minRank: number, chosen: ReadonlySet<string>): { name: string; count: number }[] {
  return countTags(tags, minRank, chosen).filter((tag) => tag.count >= 2);
}
