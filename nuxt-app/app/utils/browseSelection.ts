import { ANIME_FORMAT_LABELS } from "./studyFilters";

// Client copy of server/utils/anilistBrowseLibrary.ts's BrowseAnime.
export interface BrowseAnime {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null;
  year: number | null;
  season: "WINTER" | "SPRING" | "SUMMER" | "FALL" | null;
  format: string | null;
  averageScore: number | null;
  inLibrary: boolean;
  cardCount: number;
}

export const MAX_BROWSE_IMPORT = 300;

/** "2012 · TV · 78%": whatever of year, format and AniList score the show has. */
export function browseAnimeMeta(anime: BrowseAnime): string {
  const format = anime.format ? ANIME_FORMAT_LABELS[anime.format] ?? anime.format : null;
  const score = anime.averageScore !== null ? `${anime.averageScore}%` : null;
  return [anime.year, format, score].filter(Boolean).join(" · ");
}

/** A show already holding cards is never selectable, so the Add count matches what runs. */
export function selectableIds(results: readonly BrowseAnime[]): number[] {
  return results.filter((anime) => !anime.inLibrary).map((anime) => anime.aniListId);
}

/** Ticked shows in list order, capped; `truncated` says ticked shows were left out. */
export function selectedForRun(
  results: readonly BrowseAnime[],
  unticked: ReadonlySet<number>,
  cap = MAX_BROWSE_IMPORT,
): { ids: number[]; truncated: boolean } {
  const ticked = selectableIds(results).filter((id) => !unticked.has(id));
  return { ids: ticked.slice(0, cap), truncated: ticked.length > cap };
}

/** Appends a later page, dropping any show an earlier page already had. */
export function mergePage(existing: readonly BrowseAnime[], incoming: readonly BrowseAnime[]): BrowseAnime[] {
  const seen = new Set(existing.map((anime) => anime.aniListId));
  return [...existing, ...incoming.filter((anime) => !seen.has(anime.aniListId))];
}
