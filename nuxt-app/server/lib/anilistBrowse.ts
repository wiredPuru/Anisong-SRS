import type { BrowseFilters } from "../utils/anilistBrowseBody.ts";
import { ANIME_SEASONS, requestAniList, type AnimeSeason } from "./anilist.ts";
import { isRecord, ProviderUnavailableError } from "./graphql.ts";

export const BROWSE_PAGE_SIZE = 50;

export interface AniListBrowseItem {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null;
  year: number | null;
  season: AnimeSeason | null;
  format: string | null;
  averageScore: number | null;
  popularity: number;
}

const BROWSE_QUERY = `
  query (
    $page: Int, $perPage: Int, $sort: [MediaSort], $isAdult: Boolean, $season: MediaSeason,
    $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt,
    $scoreGreater: Int, $scoreLesser: Int, $formatIn: [MediaFormat],
    $genreIn: [String], $genreNotIn: [String], $tagIn: [String], $tagNotIn: [String], $minimumTagRank: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        type: ANIME, sort: $sort, isAdult: $isAdult, season: $season,
        startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser,
        averageScore_greater: $scoreGreater, averageScore_lesser: $scoreLesser, format_in: $formatIn,
        genre_in: $genreIn, genre_not_in: $genreNotIn, tag_in: $tagIn, tag_not_in: $tagNotIn,
        minimumTagRank: $minimumTagRank
      ) {
        id
        title { romaji english native }
        coverImage { large }
        season
        seasonYear
        startDate { year }
        format
        averageScore
        popularity
      }
    }
  }
`;

// AniList's date and score bounds are exclusive, so each is widened by one step
// to make the filter's own bounds inclusive. A year-only start date is stored as
// YYYY0000, which falls inside the range it belongs to.
export function buildBrowseVariables(filters: BrowseFilters, page: number, season: AnimeSeason | null = null): Record<string, unknown> {
  const variables: Record<string, unknown> = {
    page,
    perPage: BROWSE_PAGE_SIZE,
    sort: ["POPULARITY_DESC"],
    isAdult: false,
  };
  if (season) variables.season = season;
  if (filters.yearMin !== null) variables.startDateGreater = (filters.yearMin - 1) * 10000 + 1231;
  if (filters.yearMax !== null) variables.startDateLesser = filters.yearMax * 10000 + 1232;
  if (filters.scoreMin !== null) variables.scoreGreater = filters.scoreMin - 1;
  if (filters.scoreMax !== null) variables.scoreLesser = filters.scoreMax + 1;
  if (filters.formats.length) variables.formatIn = filters.formats;
  if (filters.genresInclude.length) variables.genreIn = filters.genresInclude;
  if (filters.genresExclude.length) variables.genreNotIn = filters.genresExclude;
  if (filters.tagsInclude.length) variables.tagIn = filters.tagsInclude;
  if (filters.tagsExclude.length) variables.tagNotIn = filters.tagsExclude;
  if (filters.tagsInclude.length || filters.tagsExclude.length) variables.minimumTagRank = filters.tagMinRank;
  return variables;
}

const isNullableInt = (value: unknown): value is number | null | undefined =>
  value == null || (typeof value === "number" && Number.isSafeInteger(value));
const isNullableString = (value: unknown): value is string | null | undefined => value == null || typeof value === "string";

function toBrowseItem(media: unknown): AniListBrowseItem {
  if (!isRecord(media) || !Number.isSafeInteger(media.id) || Number(media.id) <= 0
    || !isRecord(media.title) || typeof media.title.romaji !== "string" || !media.title.romaji.trim()
    || !isNullableString(media.title.english) || !isNullableString(media.title.native)
    || (media.coverImage != null && (!isRecord(media.coverImage) || !isNullableString(media.coverImage.large)))
    || !isNullableInt(media.seasonYear) || !isNullableInt(media.averageScore) || !isNullableString(media.format)
    || (media.startDate != null && (!isRecord(media.startDate) || !isNullableInt(media.startDate.year)))
    || (media.popularity != null && !isNullableInt(media.popularity))) {
    throw new ProviderUnavailableError("AniList");
  }
  const startYear = isRecord(media.startDate) && typeof media.startDate.year === "number" ? media.startDate.year : null;
  return {
    aniListId: Number(media.id),
    titleRomaji: media.title.romaji,
    titleEnglish: media.title.english ?? null,
    titleNative: media.title.native ?? null,
    coverImageUrl: isRecord(media.coverImage) ? (media.coverImage.large ?? null) : null,
    year: media.seasonYear ?? startYear,
    season: ANIME_SEASONS.find((known) => known === media.season) ?? null,
    format: media.format ?? null,
    averageScore: media.averageScore ?? null,
    popularity: typeof media.popularity === "number" ? media.popularity : 0,
  };
}

interface BrowsePage {
  items: AniListBrowseItem[];
  hasNextPage: boolean;
}

function fetchBrowsePage(filters: BrowseFilters, page: number, season: AnimeSeason | null): Promise<BrowsePage> {
  return requestAniList(BROWSE_QUERY, buildBrowseVariables(filters, page, season), (data) => {
    const result = data?.Page;
    if (!isRecord(result) || !Array.isArray(result.media) || !isRecord(result.pageInfo)) {
      throw new ProviderUnavailableError("AniList");
    }
    return { items: result.media.map(toBrowseItem), hasNextPage: result.pageInfo.hasNextPage === true };
  });
}

/**
 * One page of AniList's catalog, most popular first. AniList takes a single
 * season per query, so several seasons run in parallel for the same page and
 * merge by popularity; the page is then approximately, not strictly, ordered.
 */
export async function browseAniList(filters: BrowseFilters, page: number): Promise<BrowsePage> {
  const seasons: (AnimeSeason | null)[] = filters.seasons.length ? filters.seasons : [null];
  const pages = await Promise.all(seasons.map((season) => fetchBrowsePage(filters, page, season)));
  const seen = new Set<number>();
  const items = pages
    .flatMap((entry) => entry.items)
    .filter((item) => !seen.has(item.aniListId) && seen.add(item.aniListId))
    .sort((a, b) => b.popularity - a.popularity);
  return { items, hasNextPage: pages.some((entry) => entry.hasNextPage) };
}

export interface BrowseOptions {
  genres: string[];
  tags: { name: string; category: string }[];
}

const OPTIONS_QUERY = `
  query {
    GenreCollection
    MediaTagCollection { name category isAdult }
  }
`;

// Adult genres and tags are never offered: browsing excludes adult titles, so a
// filter on them could only ever return nothing.
export function fetchBrowseOptions(): Promise<BrowseOptions> {
  return requestAniList(OPTIONS_QUERY, {}, (data) => {
    if (!data || !Array.isArray(data.GenreCollection) || !Array.isArray(data.MediaTagCollection)
      || !data.GenreCollection.every((genre) => typeof genre === "string")) {
      throw new ProviderUnavailableError("AniList");
    }
    const tags = data.MediaTagCollection.map((tag: unknown) => {
      if (!isRecord(tag) || typeof tag.name !== "string" || typeof tag.category !== "string") {
        throw new ProviderUnavailableError("AniList");
      }
      return { name: tag.name, category: tag.category, isAdult: tag.isAdult === true };
    });
    return {
      genres: (data.GenreCollection as string[]).filter((genre) => genre !== "Hentai"),
      tags: tags.filter((tag) => !tag.isAdult).map(({ name, category }) => ({ name, category })),
    };
  });
}
