import { kanjiDeckAfter } from "~/utils/kanjiDeck";

// Shared so every tile, chip and the rail agree on what is in the deck.
export function useKanjiDeck() {
  const chars = useState<Set<string>>("kanjiDeckChars", () => new Set());
  const loaded = useState<boolean>("kanjiDeckLoaded", () => false);
  const pending = useState<Set<string>>("kanjiDeckPending", () => new Set());
  const error = useState<string | null>("kanjiDeckError", () => null);

  async function load(): Promise<void> {
    try {
      const reply = await $fetch<{ cards: { char: string }[] }>("/api/kanji/cards");
      chars.value = new Set(reply.cards.map((card) => card.char));
      loaded.value = true;
    } catch {
      // The buttons simply start from "Add"; a click reports any real failure.
    }
  }

  async function setAdded(char: string, added: boolean, sourceCardId?: number): Promise<void> {
    if (pending.value.has(char)) return;
    pending.value = new Set(pending.value).add(char);
    error.value = null;
    try {
      await $fetch("/api/kanji/cards", { method: added ? "POST" : "DELETE", body: { chars: [char], ...(added && sourceCardId !== undefined ? { sourceCardId } : {}) } });
      chars.value = kanjiDeckAfter(chars.value, char, added);
    } catch (failure) {
      error.value = extractErrorMessage(
        failure,
        added ? "Couldn't add this kanji. Try again." : "Couldn't remove this kanji. Try again.",
      );
    } finally {
      const next = new Set(pending.value);
      next.delete(char);
      pending.value = next;
    }
  }

  return { chars, loaded, pending, error, load, add: (char: string, sourceCardId?: number) => setAdded(char, true, sourceCardId), remove: (char: string) => setAdded(char, false) };
}
