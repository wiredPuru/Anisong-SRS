import { countActiveFilters, EMPTY_STUDY_FILTERS, filtersQueryValue, type StudyFilters, type StudyThemeType } from "./studyFilters";

// What "Search my library" on /cards narrows the list by. The filters never
// carry an Anime list: its ids do not fit a GET query string.
export interface LibraryFilter {
  filters: StudyFilters;
  downloadedOnly: boolean;
}

export const EMPTY_LIBRARY_FILTER: LibraryFilter = { filters: EMPTY_STUDY_FILTERS, downloadedOnly: false };

const THEME_TYPE_NAMES: Record<StudyThemeType, string> = { OP: "openings", ED: "endings", IN: "insert songs" };

export function libraryFilterActive(filter: LibraryFilter): boolean {
  return filter.downloadedOnly || countActiveFilters(filter.filters) > 0;
}

/** The `filters` and `downloaded` params GET /api/cards and /api/cards/ids read. */
export function libraryQuery(filter: LibraryFilter): { filters?: string; downloaded?: "1" } {
  return {
    filters: filtersQueryValue(filter.filters),
    downloaded: filter.downloadedOnly ? "1" : undefined,
  };
}

/** A short phrase for the chip and the delete confirm, such as "Insert songs, downloaded". */
export function describeLibraryFilter(filter: LibraryFilter): string {
  const { themeTypes } = filter.filters;
  const parts: string[] = [];
  if (themeTypes.length) parts.push(themeTypes.map((type) => THEME_TYPE_NAMES[type]).join(" + "));
  if (filter.downloadedOnly) parts.push("downloaded");
  const others = countActiveFilters(filter.filters) - Number(themeTypes.length > 0);
  if (others > 0) parts.push(`${others} other ${others === 1 ? "filter" : "filters"}`);
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
