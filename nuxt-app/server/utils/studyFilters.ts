import { and, gte, like, lte, inArray, isNotNull, not, or, sql, type SQL } from "drizzle-orm";
import { anime, song } from "../db/schema.ts";

export const THEME_TYPES = ["OP", "ED"] as const;
export type ThemeType = (typeof THEME_TYPES)[number];

export const ANIME_FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"] as const;

export const DEFAULT_TAG_MIN_RANK = 60;
const MAX_LIST_LENGTH = 50;
const MAX_NAME_LENGTH = 100;

// Load-bearing: the client keeps a hand-written copy in app/utils/studyFilters.ts
// (same field order), and 76c adds a list field.
export interface StudyFilters {
  yearMin: number | null;
  yearMax: number | null;
  scoreMin: number | null;
  scoreMax: number | null;
  formats: string[];
  themeTypes: ThemeType[];
  genresInclude: string[];
  genresExclude: string[];
  tagsInclude: string[];
  tagsExclude: string[];
  tagMinRank: number;
}

type Parsed<T> = { value: T } | { error: string };

function parseBound(raw: unknown, name: string, min: number, max: number): Parsed<number | null> {
  if (raw == null) return { value: null };
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    return { error: `${name} must be a whole number from ${min} to ${max}` };
  }
  return { value: raw };
}

function parseNames(raw: unknown, name: string, allowed?: readonly string[]): Parsed<string[]> {
  if (raw == null) return { value: [] };
  if (!Array.isArray(raw) || raw.length > MAX_LIST_LENGTH) {
    return { error: `${name} must be a list of at most ${MAX_LIST_LENGTH} entries` };
  }
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry.trim() || entry.length > MAX_NAME_LENGTH) {
      return { error: `${name} entries must be non-empty text of at most ${MAX_NAME_LENGTH} characters` };
    }
    if (allowed && !allowed.includes(entry)) return { error: `${name} has an unknown value: ${entry}` };
  }
  return { value: [...new Set(raw as string[])] };
}

function isEmpty(filters: StudyFilters): boolean {
  return [filters.yearMin, filters.yearMax, filters.scoreMin, filters.scoreMax].every((bound) => bound === null)
    && [filters.formats, filters.themeTypes, filters.genresInclude, filters.genresExclude, filters.tagsInclude, filters.tagsExclude]
      .every((list) => list.length === 0);
}

// Missing fields take their defaults so an older stored filter set still
// parses; a present field of the wrong shape is an error, never ignored.
export function parseStudyFilters(raw: unknown): { filters: StudyFilters | null } | { error: string } {
  if (raw === undefined || raw === "") return { filters: null };
  if (typeof raw !== "string") return { error: "filters must be a JSON string" };
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return { error: "filters is not valid JSON" };
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { error: "filters must be a JSON object" };
  const body = input as Record<string, unknown>;

  const fields = {
    yearMin: parseBound(body.yearMin, "yearMin", 1900, 2100),
    yearMax: parseBound(body.yearMax, "yearMax", 1900, 2100),
    scoreMin: parseBound(body.scoreMin, "scoreMin", 0, 100),
    scoreMax: parseBound(body.scoreMax, "scoreMax", 0, 100),
    formats: parseNames(body.formats, "formats", ANIME_FORMATS),
    themeTypes: parseNames(body.themeTypes, "themeTypes", THEME_TYPES),
    genresInclude: parseNames(body.genresInclude, "genresInclude"),
    genresExclude: parseNames(body.genresExclude, "genresExclude"),
    tagsInclude: parseNames(body.tagsInclude, "tagsInclude"),
    tagsExclude: parseNames(body.tagsExclude, "tagsExclude"),
    tagMinRank: body.tagMinRank == null ? { value: DEFAULT_TAG_MIN_RANK } : parseBound(body.tagMinRank, "tagMinRank", 0, 100),
  };
  for (const field of Object.values(fields)) {
    if ("error" in field) return { error: field.error };
  }
  const filters = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, (field as { value: unknown }).value]),
  ) as unknown as StudyFilters;

  if (filters.yearMin !== null && filters.yearMax !== null && filters.yearMin > filters.yearMax) {
    return { error: "yearMin must not be after yearMax" };
  }
  if (filters.scoreMin !== null && filters.scoreMax !== null && filters.scoreMin > filters.scoreMax) {
    return { error: "scoreMin must not be above scoreMax" };
  }
  return { filters: isEmpty(filters) ? null : filters };
}

function hasGenre(name: string): SQL {
  return sql`exists (select 1 from json_each(${anime.genres}) where json_each.value = ${name})`;
}

function hasTag(name: string, minRank: number): SQL {
  return sql`exists (select 1 from json_each(${anime.tags}) where json_extract(json_each.value, '$.name') = ${name} and json_extract(json_each.value, '$.rank') >= ${minRank})`;
}

// Reads anime and song columns directly, so it only works inside a query that
// already joins both (every due query does). An active year, score, or format
// filter drops an anime whose value is unknown: it cannot be shown to match.
export function studyFilterCondition(filters: StudyFilters | null): SQL | undefined {
  if (!filters) return undefined;
  const conditions: (SQL | undefined)[] = [];
  if (filters.yearMin !== null || filters.yearMax !== null) conditions.push(isNotNull(anime.year));
  if (filters.yearMin !== null) conditions.push(gte(anime.year, filters.yearMin));
  if (filters.yearMax !== null) conditions.push(lte(anime.year, filters.yearMax));
  if (filters.scoreMin !== null || filters.scoreMax !== null) conditions.push(isNotNull(anime.averageScore));
  if (filters.scoreMin !== null) conditions.push(gte(anime.averageScore, filters.scoreMin));
  if (filters.scoreMax !== null) conditions.push(lte(anime.averageScore, filters.scoreMax));
  if (filters.formats.length) conditions.push(inArray(anime.format, filters.formats));
  if (filters.themeTypes.length) conditions.push(or(...filters.themeTypes.map((type) => like(song.themeSlot, `${type}%`))));
  conditions.push(...filters.genresInclude.map(hasGenre));
  conditions.push(...filters.genresExclude.map((genre) => not(hasGenre(genre))));
  conditions.push(...filters.tagsInclude.map((tag) => hasTag(tag, filters.tagMinRank)));
  conditions.push(...filters.tagsExclude.map((tag) => not(hasTag(tag, filters.tagMinRank))));
  return and(...conditions);
}
