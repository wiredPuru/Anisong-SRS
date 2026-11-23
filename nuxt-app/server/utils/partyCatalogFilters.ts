import { ANIME_SEASONS, type AnimeSeason } from "../lib/anilist.ts";
import type { StudyFilters } from "./studyFilters.ts";

type SongType = "opening" | "ending" | "insert";
type AnimeType = "tv" | "movie" | "ova" | "ona" | "special" | "other";

interface LabelFilter {
  require_all?: string[];
  exclude?: string[];
}

/** The subset of AnisongDB's SongFilterOptions the endless queue sends. */
export interface AnisongSongFilterOptions {
  song_types?: SongType[];
  anime_types?: AnimeType[];
  season?: { start: string | null; end: string | null };
  genres?: LabelFilter;
  tags?: LabelFilter;
}

// Load-bearing: 128b sends `options` on mal_ids_request too.
export interface CatalogSongFilters {
  options: AnisongSongFilterOptions;
  /** Seasons to check after fetching; null when the season range covers them. */
  seasons: AnimeSeason[] | null;
  /** Filters that are set but that AnisongDB cannot apply. */
  notApplied: string[];
}

const SONG_TYPE: Record<string, SongType> = { OP: "opening", ED: "ending", IN: "insert" };

const ANIME_TYPE: Record<string, AnimeType> = {
  TV: "tv",
  TV_SHORT: "tv",
  MOVIE: "movie",
  SPECIAL: "special",
  OVA: "ova",
  ONA: "ona",
  MUSIC: "other",
};

const SEASON_NAME: Record<AnimeSeason, string> = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };

function labels(include: string[], exclude: string[]): LabelFilter | undefined {
  if (!include.length && !exclude.length) return undefined;
  return { ...(include.length ? { require_all: include } : {}), ...(exclude.length ? { exclude } : {}) };
}

/** Picked seasons in calendar order, when they form one unbroken run. */
function contiguousRun(seasons: AnimeSeason[]): AnimeSeason[] | null {
  const indexes = [...new Set(seasons.map((season) => ANIME_SEASONS.indexOf(season)))].sort((a, b) => a - b);
  const unbroken = indexes.every((index, i) => i === 0 || index === indexes[i - 1]! + 1);
  return unbroken ? indexes.map((index) => ANIME_SEASONS[index]!) : null;
}

function seasonRange(filters: StudyFilters): { range: AnisongSongFilterOptions["season"]; postCheck: AnimeSeason[] | null } {
  const { yearMin, yearMax, seasons } = filters;
  const run = seasons.length ? contiguousRun(seasons) : null;
  // One year and an unbroken run of seasons is an exact range; anything else
  // with seasons picked needs checking song by song.
  if (seasons.length && yearMin !== null && yearMin === yearMax && run) {
    return { range: { start: `${SEASON_NAME[run[0]!]} ${yearMin}`, end: `${SEASON_NAME[run[run.length - 1]!]} ${yearMin}` }, postCheck: null };
  }
  const postCheck = seasons.length ? [...seasons] : null;
  if (yearMin === null && yearMax === null) return { range: undefined, postCheck };
  return {
    range: { start: yearMin === null ? null : `Winter ${yearMin}`, end: yearMax === null ? null : `Fall ${yearMax}` },
    postCheck,
  };
}

function notAppliedNames(filters: StudyFilters): string[] {
  const names: string[] = [];
  if (filters.scoreMin !== null || filters.scoreMax !== null) names.push("AniList score");
  if (filters.studios.length) names.push("Studio");
  if (filters.listAniListIds !== null) names.push("Anime list");
  if (filters.tagsInclude.length || filters.tagsExclude.length) names.push("Tag relevance");
  if (filters.themeMix !== null) names.push("OP/ED mix");
  return names;
}

/** The endless queue's Study filters as AnisongDB song filters. */
export function catalogSongFilters(filters: StudyFilters | null, includeInserts: boolean): CatalogSongFilters {
  const defaultTypes: SongType[] = includeInserts ? ["opening", "ending", "insert"] : ["opening", "ending"];
  if (!filters) return { options: { song_types: defaultTypes }, seasons: null, notApplied: [] };

  const songTypes = filters.themeTypes.map((type) => SONG_TYPE[type]).filter((type): type is SongType => type !== undefined);
  const animeTypes = [...new Set(filters.formats.map((format) => ANIME_TYPE[format]).filter((type): type is AnimeType => type !== undefined))];
  const { range, postCheck } = seasonRange(filters);
  const genres = labels(filters.genresInclude, filters.genresExclude);
  const tags = labels(filters.tagsInclude, filters.tagsExclude);

  return {
    options: {
      song_types: songTypes.length ? songTypes : defaultTypes,
      ...(animeTypes.length ? { anime_types: animeTypes } : {}),
      ...(range ? { season: range } : {}),
      ...(genres ? { genres } : {}),
      ...(tags ? { tags } : {}),
    },
    seasons: postCheck,
    notApplied: notAppliedNames(filters),
  };
}

/** Whether an AnisongDB vintage such as "Fall 2013" is one of the seasons. */
export function matchesSeasons(vintage: string | null, seasons: AnimeSeason[] | null): boolean {
  if (!seasons) return true;
  const name = vintage?.trim().split(/\s+/)[0]?.toUpperCase();
  return seasons.some((season) => season === name);
}

function withoutNames(filter: LabelFilter | undefined, drop: Set<string>): LabelFilter | undefined {
  if (!filter) return undefined;
  return labels((filter.require_all ?? []).filter((name) => !drop.has(name)), (filter.exclude ?? []).filter((name) => !drop.has(name)));
}

/** The options with genres and tags AnisongDB does not know taken out. */
export function withoutLabels(options: AnisongSongFilterOptions, unknown: Iterable<string>): AnisongSongFilterOptions {
  const drop = new Set(unknown);
  if (!drop.size) return options;
  const { genres, tags, ...rest } = options;
  const keptGenres = withoutNames(genres, drop);
  const keptTags = withoutNames(tags, drop);
  return { ...rest, ...(keptGenres ? { genres: keptGenres } : {}), ...(keptTags ? { tags: keptTags } : {}) };
}
