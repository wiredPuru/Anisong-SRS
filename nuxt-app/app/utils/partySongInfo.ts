import type { PartyAnswerFacts } from "~/composables/usePartyDisplay";
import { seasonYearLabel } from "./partyRevealFacts";
import { ANIME_FORMAT_LABELS } from "./studyFilters";

export interface SongInfoRow {
  label: string;
  value: string;
}

/** The host's fact rows for a song, in display order, leaving out anything the show lacks. */
export function songInfoRows(facts: PartyAnswerFacts | undefined): SongInfoRow[] {
  if (!facts) return [];
  const rows: { label: string; value: string | null }[] = [
    { label: "Aired", value: seasonYearLabel(facts) },
    { label: "Format", value: facts.format ? ANIME_FORMAT_LABELS[facts.format] ?? facts.format : null },
    { label: "AniList score", value: facts.averageScore !== null ? `${facts.averageScore}%` : null },
    { label: facts.studios.length > 1 ? "Studios" : "Studio", value: facts.studios.length ? facts.studios.join(", ") : null },
    { label: "Tags", value: facts.tags.length ? facts.tags.join(", ") : null },
  ];
  return rows.filter((row): row is SongInfoRow => row.value !== null);
}

