import type { PartyEndless } from "~/composables/usePartyHost";

/** The New game tab's source and filters, which endless play draws from. */
export interface PartyEndlessSource {
  /** Null while a manual deck is chosen but not picked yet. */
  scope: PartyEndless["scope"] | null;
  filters: string | undefined;
}
