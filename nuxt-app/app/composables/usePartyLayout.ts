import {
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  type PartyLayout,
  type PartyPieceId,
  type PartyPlacement,
  parseLayout,
  serializeLayout,
} from "~/utils/partyLayout";

/**
 * Where the party display's pieces sit (feature 91b), shared between the page
 * and the player, and kept in this browser only. Storage can be blocked; the
 * layout then works for the session and is simply not remembered.
 */
export function usePartyLayout() {
  const layout = useState<PartyLayout>("partyLayout", () => ({ ...DEFAULT_LAYOUT }));
  const loaded = useState("partyLayoutLoaded", () => false);
  const editing = useState("partyLayoutEditing", () => false);

  if (import.meta.client && !loaded.value) {
    loaded.value = true;
    try {
      layout.value = parseLayout(localStorage.getItem(LAYOUT_STORAGE_KEY));
    } catch {
      // Defaults stand.
    }
  }

  function place(piece: PartyPieceId, placement: PartyPlacement) {
    layout.value = { ...layout.value, [piece]: placement };
  }

  function save() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, serializeLayout(layout.value));
    } catch {
      // Not remembered, but still applied.
    }
  }

  function reset() {
    layout.value = { ...DEFAULT_LAYOUT };
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // Nothing stored to clear.
    }
  }

  return { layout, editing, place, save, reset };
}
