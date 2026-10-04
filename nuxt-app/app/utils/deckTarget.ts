export type DeckTarget =
  | { mode: "none" }
  | { mode: "existing"; deckId: number }
  | { mode: "new"; name: string };

export const NO_DECK_TARGET: DeckTarget = { mode: "none" };

/** Why Add must wait, or null. Only a new deck can be wrong: it needs a name. */
export function deckTargetProblem(target: DeckTarget): string | null {
  return target.mode === "new" && target.name.trim() === "" ? "Name the new deck first." : null;
}

/**
 * The deck id to import into, creating a new deck first. `adopt` is told the
 * created id so the caller can switch to it, which keeps a retry from making
 * the deck twice. A failed create throws and nothing has been imported yet.
 */
export async function resolveDeckTarget(
  target: DeckTarget,
  createDeck: (name: string) => Promise<number>,
  adopt: (target: DeckTarget) => void,
): Promise<number | null> {
  if (target.mode === "none") return null;
  if (target.mode === "existing") return target.deckId;
  const deckId = await createDeck(target.name.trim());
  adopt({ mode: "existing", deckId });
  return deckId;
}
