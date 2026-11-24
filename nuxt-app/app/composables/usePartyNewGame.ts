import { EMPTY_STUDY_FILTERS, filtersQueryValue, type StudyFilters } from "~/utils/studyFilters";
import type { PartyEndlessSource } from "~/components/party/partyEndlessSource";

export type PartyNewGameSourceType = "all" | "created";
export interface PartyNewGameDeck {
  id: number;
  label: string;
  cardCount: number;
}

/**
 * The host's New game form. Shared, because the form moves from the middle
 * column into Settings when a game starts, and endless play draws from it.
 */
export function usePartyNewGame() {
  const sourceType = useState<PartyNewGameSourceType>("partyNewGame:sourceType", () => "all");
  const deckQuery = useState("partyNewGame:deckQuery", () => "");
  const selectedDeck = useState<PartyNewGameDeck | null>("partyNewGame:deck", () => null);
  const filters = useState<StudyFilters>("partyNewGame:filters", () => structuredClone(EMPTY_STUDY_FILTERS));
  const shuffle = useState("partyNewGame:shuffle", () => true);
  const downloadedOnly = useState("partyNewGame:downloadedOnly", () => false);

  const endlessSource = computed<PartyEndlessSource>(() => ({
    scope: sourceType.value === "all" ? { type: "all" } : selectedDeck.value ? { type: "created", id: selectedDeck.value.id } : null,
    filters: filtersQueryValue(filters.value),
  }));

  return { sourceType, deckQuery, selectedDeck, filters, shuffle, downloadedOnly, endlessSource };
}
