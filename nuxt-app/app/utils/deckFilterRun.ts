import type { ImportBatchResult } from "./importAnimeBatch";

// Client copy of the library half's reply from POST /api/decks/copy-filtered.
interface LibraryCopy {
  added: number;
  alreadyInDeck: number;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Cards that landed in the deck from both halves of one Add. */
export function combinedAddedCount(library: LibraryCopy | null, imports: ImportBatchResult | null): number {
  return (library?.added ?? 0) + (imports?.addedToDeck ?? 0);
}

/** One sentence for a whole run: the library copy, then the AniList imports. */
export function summarizeDeckFilterRun(library: LibraryCopy | null, imports: ImportBatchResult | null): string {
  const parts: string[] = [];
  if (library) {
    const already = library.alreadyInDeck ? ` (${library.alreadyInDeck} already in deck)` : "";
    parts.push(`Added ${plural(library.added, "card")} from your library${already}.`);
  }
  if (imports) {
    parts.push(`Imported ${plural(imports.done - imports.failed, "show")} from AniList and added ${plural(imports.addedToDeck, "card")} to the deck.`);
    if (imports.cancelled) parts.push("Stopped early.");
    if (imports.failed) parts.push(`${imports.failed} failed.`);
    if (imports.empty) parts.push(`${imports.empty} had nothing addable under your clip settings.`);
  }
  return parts.join(" ");
}
