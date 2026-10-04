import { ANIME_SEASONS, type AnimeSeason } from "../lib/anilist.ts";
import { ANIME_FORMATS, DEFAULT_TAG_MIN_RANK } from "./studyFilters.ts";

// The StudyFilters fields that apply to AniList's whole catalog, same names and
// order (OP/ED and list filters mean nothing there).
export interface BrowseFilters {
  yearMin: number | null;
  yearMax: number | null;
  seasons: AnimeSeason[];
  scoreMin: number | null;
  scoreMax: number | null;
  formats: string[];
  genresInclude: string[];
  genresExclude: string[];
  tagsInclude: string[];
  tagsExclude: string[];
  tagMinRank: number;
}

export interface BrowseBody {
  filters: BrowseFilters;
  page: number;
}

export const MAX_BROWSE_PAGE = 200;
const MAX_LIST = 50;
const MAX_NAME = 100;

function bound(value: unknown, min: number, max: number, field: string): number | null | { error: string } {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return { error: `${field} must be a whole number from ${min} to ${max}` };
  }
  return value;
}

function names(value: unknown, field: string): string[] | { error: string } {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_LIST
    || !value.every((entry) => typeof entry === "string" && entry.trim() !== "" && entry.length <= MAX_NAME)) {
    return { error: `${field} must be a list of up to ${MAX_LIST} names` };
  }
  return [...new Set(value as string[])];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T[] | { error: string } {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((entry): entry is T => allowed.includes(entry))) {
    return { error: `${field} has an unknown value` };
  }
  return [...new Set(value)];
}

const failed = <T>(value: T | { error: string }): value is { error: string } =>
  typeof value === "object" && value !== null && "error" in value;

export function parseBrowseBody(raw: unknown): BrowseBody | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "A request body is required" };
  const body = raw as Record<string, unknown>;
  const page = body.page === undefined ? 1 : body.page;
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > MAX_BROWSE_PAGE) {
    return { error: `page must be a whole number from 1 to ${MAX_BROWSE_PAGE}` };
  }
  const source = (typeof body.filters === "object" && body.filters !== null ? body.filters : {}) as Record<string, unknown>;

  const yearMin = bound(source.yearMin, 1900, 2100, "yearMin");
  const yearMax = bound(source.yearMax, 1900, 2100, "yearMax");
  const scoreMin = bound(source.scoreMin, 0, 100, "scoreMin");
  const scoreMax = bound(source.scoreMax, 0, 100, "scoreMax");
  const tagMinRank = source.tagMinRank === undefined ? DEFAULT_TAG_MIN_RANK : bound(source.tagMinRank, 0, 100, "tagMinRank");
  const seasons = oneOf(source.seasons, ANIME_SEASONS, "seasons");
  const formats = oneOf(source.formats, ANIME_FORMATS, "formats");
  const genresInclude = names(source.genresInclude, "genresInclude");
  const genresExclude = names(source.genresExclude, "genresExclude");
  const tagsInclude = names(source.tagsInclude, "tagsInclude");
  const tagsExclude = names(source.tagsExclude, "tagsExclude");

  for (const part of [yearMin, yearMax, scoreMin, scoreMax, tagMinRank, seasons, formats, genresInclude, genresExclude, tagsInclude, tagsExclude]) {
    if (failed(part)) return part;
  }
  if (typeof yearMin === "number" && typeof yearMax === "number" && yearMin > yearMax) return { error: "yearMin cannot be after yearMax" };
  if (typeof scoreMin === "number" && typeof scoreMax === "number" && scoreMin > scoreMax) return { error: "scoreMin cannot be above scoreMax" };

  return {
    page,
    filters: {
      yearMin: yearMin as number | null,
      yearMax: yearMax as number | null,
      seasons: seasons as AnimeSeason[],
      scoreMin: scoreMin as number | null,
      scoreMax: scoreMax as number | null,
      formats: formats as string[],
      genresInclude: genresInclude as string[],
      genresExclude: genresExclude as string[],
      tagsInclude: tagsInclude as string[],
      tagsExclude: tagsExclude as string[],
      tagMinRank: tagMinRank as number,
    },
  };
}
