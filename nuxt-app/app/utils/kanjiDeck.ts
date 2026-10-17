import type { KanjiEntry } from "./japaneseBreakdown";

// Only a character with a dictionary entry can be studied (the server refuses the rest).
export function canAddToKanjiDeck(entry: KanjiEntry | null | undefined): entry is KanjiEntry {
  return Boolean(entry);
}

export function kanjiDeckAfter(deck: ReadonlySet<string>, char: string, added: boolean): Set<string> {
  const next = new Set(deck);
  if (added) next.add(char);
  else next.delete(char);
  return next;
}
