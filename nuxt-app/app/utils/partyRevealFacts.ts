import type { PartyAnswerFacts } from "~/composables/usePartyDisplay";
import { ANIME_FORMAT_LABELS } from "./studyFilters";

const SEASON_LABELS: Record<string, string> = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };

/** "Spring 2009 · TV · Kyoto Animation · 79%": whichever of the reveal's facts the show has. */
export function revealFactLine(facts: PartyAnswerFacts | undefined): string {
  if (!facts) return "";
  const season = facts.season ? SEASON_LABELS[facts.season] : undefined;
  const when = facts.year !== null ? (season ? `${season} ${facts.year}` : String(facts.year)) : null;
  const format = facts.format ? ANIME_FORMAT_LABELS[facts.format] ?? facts.format : null;
  const studios = facts.studios.length ? facts.studios.join(", ") : null;
  const score = facts.averageScore !== null ? `${facts.averageScore}%` : null;
  return [when, format, studios, score].filter(Boolean).join(" · ");
}
