import { ANIME_FORMAT_LABELS, type StudyFilters } from "./studyFilters";

export interface FilterChip {
  label: string;
  exclude?: boolean;
}

const THEME_LABELS = { OP: "Openings", ED: "Endings", IN: "Inserts" } as const;
const SEASON_LABELS = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" } as const;

function range(min: number | null, max: number | null, unit = ""): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return min === max ? `${min}${unit}` : `${min}${unit} to ${max}${unit}`;
  return min !== null ? `${min}${unit} or more` : `Up to ${max}${unit}`;
}

/** The active filters as short chips, in the order the filter form shows them. */
export function describeFilters(filters: StudyFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (label: string | null, exclude = false) => {
    if (label) chips.push(exclude ? { label, exclude } : { label });
  };
  for (const type of filters.themeTypes) add(THEME_LABELS[type]);
  if (filters.themeMix) add("Custom OP/ED mix");
  add(range(filters.yearMin, filters.yearMax));
  for (const season of filters.seasons) add(SEASON_LABELS[season]);
  const score = range(filters.scoreMin, filters.scoreMax);
  add(score ? `Score ${score.charAt(0).toLowerCase()}${score.slice(1)}` : null);
  for (const format of filters.formats) add(ANIME_FORMAT_LABELS[format] ?? format);
  for (const studio of filters.studios) add(studio);
  for (const genre of filters.genresInclude) add(genre);
  for (const genre of filters.genresExclude) add(genre, true);
  for (const tag of filters.tagsInclude) add(tag);
  for (const tag of filters.tagsExclude) add(tag, true);
  if (filters.listAniListIds !== null) add(filters.listSource ? `${filters.listSource.username}'s list` : "Anime list");
  return chips;
}

/** Seconds as m:ss, for the progress bar. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
