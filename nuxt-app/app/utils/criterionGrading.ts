import type { TypedAnswerCategories } from "./typedAnswerCategories";

// Client copy of server/utils/gradingCriterion.ts's list (F-09), same order.
export const GRADING_CATEGORIES = ["title", "song", "slot", "artist"] as const;
export type GradingCategory = (typeof GRADING_CATEGORIES)[number];

export const GRADING_CRITERIA = [
  "title",
  "song",
  "artist",
  "title+song",
  "title+slot",
  "title+artist",
  "song+artist",
  "title+song+slot",
  "title+song+artist",
  "title+slot+artist",
  "title+song+slot+artist",
] as const;
export type GradingCriterion = (typeof GRADING_CRITERIA)[number];

export function criterionCategories(criterion: GradingCriterion): GradingCategory[] {
  return criterion.split("+") as GradingCategory[];
}

/** The canonical criterion for a set of categories, or null when it is empty or grades "slot" without "title". */
export function buildCriterion(categories: Iterable<GradingCategory>): GradingCriterion | null {
  const chosen = new Set(categories);
  const joined = GRADING_CATEGORIES.filter((category) => chosen.has(category)).join("+");
  return (GRADING_CRITERIA as readonly string[]).includes(joined) ? (joined as GradingCriterion) : null;
}

export interface RequiredCategories {
  anime: boolean;
  songName: boolean;
  themeSlot: boolean;
  artist: boolean;
}

export function requiredCategories(criterion: GradingCriterion): RequiredCategories {
  const categories = criterionCategories(criterion);
  return {
    anime: categories.includes("title"),
    songName: categories.includes("song"),
    themeSlot: categories.includes("slot"),
    artist: categories.includes("artist"),
  };
}

/**
 * Which answer boxes a typed round shows beside the main answer. Only the
 * anime-title track offers feature 66's optional bonuses; a deck graded on
 * anything else asks exactly what it grades, whatever the stored preference.
 */
export function visibleAnswerCategories(criterion: GradingCriterion, stored: TypedAnswerCategories): TypedAnswerCategories {
  if (criterion === "title") return { ...stored };
  const required = requiredCategories(criterion);
  return { themeSlot: required.themeSlot, songName: required.songName };
}

/**
 * Pass/Fail for a typed round. `anime` is null when the anime was not asked or
 * was given up; the others are null when left blank. A required category must
 * be answered and correct, and one that is not required never affects the
 * result.
 */
export function gradeTypedRound(
  criterion: GradingCriterion,
  answers: { anime: "pass" | "fail" | null; song: boolean | null; themeSlot: boolean | null; artist: boolean | null },
): "pass" | "fail" {
  const required = requiredCategories(criterion);
  if (required.anime && answers.anime !== "pass") return "fail";
  if (required.songName && answers.song !== true) return "fail";
  if (required.themeSlot && answers.themeSlot !== true) return "fail";
  if (required.artist && answers.artist !== true) return "fail";
  return "pass";
}

const CATEGORY_COPY: Record<GradingCategory, { solo: string; short: string; spoken: string }> = {
  title: { solo: "Anime title", short: "anime", spoken: "the anime" },
  song: { solo: "Song name", short: "song", spoken: "the song name" },
  slot: { solo: "OP/ED number", short: "OP/ED", spoken: "the OP/ED number" },
  artist: { solo: "Artist", short: "artist", spoken: "the artist" },
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function spokenList(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * How a deck's criterion is named: `chip` for Typed Answers ("Graded on: ..."),
 * `prompt` for manual Pass/Fail, `track` beside the info panel's box, and
 * `spoken` as a phrase for running text ("the anime and the song name").
 */
export function describeCriterion(criterion: GradingCriterion): { chip: string; prompt: string; track: string; spoken: string } {
  const copy = criterionCategories(criterion).map((category) => CATEGORY_COPY[category]);
  const combined = capitalize(copy.map((c) => c.short).join(" + "));
  const solo = copy.length === 1 ? copy[0]! : null;
  const spoken = spokenList(copy.map((c) => c.spoken));
  return {
    chip: solo ? solo.solo : combined,
    prompt: `Grade yourself on ${spoken}`,
    track: solo ? capitalize(solo.short) : combined,
    spoken,
  };
}
