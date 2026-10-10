import {
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  type PartyLayout,
  type PartyPieceId,
  type PartyPlacement,
  type PartyCategoryId,
  type PartyLayoutSettings,
  type ChoiceStyle,
  DEFAULT_SETTINGS,
  parseLayout,
  parseLayoutSettings,
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
  const settings = useState<PartyLayoutSettings>("partyLayoutSettings", () => ({ ...DEFAULT_SETTINGS, hidden: [] }));
  const editing = useState("partyLayoutEditing", () => false);
  // Session-only: whether dragging snaps to the grid (hold Alt to override once).
  const snap = useState("partyLayoutSnap", () => true);
  const category = useState<PartyCategoryId>("partyLayoutCategory", () => "main");
  // The one piece being edited; while set, every other piece waits dimmed.
  const selected = useState<PartyPieceId | null>("partyLayoutSelected", () => null);

  if (import.meta.client && !loaded.value) {
    loaded.value = true;
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      layout.value = parseLayout(raw);
      settings.value = parseLayoutSettings(raw);
    } catch {
      // Defaults stand.
    }
  }

  function place(piece: PartyPieceId, placement: PartyPlacement) {
    layout.value = { ...layout.value, [piece]: placement };
  }

  function save() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, serializeLayout(layout.value, settings.value));
    } catch {
      // Not remembered, but still applied.
    }
  }

  function reset() {
    layout.value = { ...DEFAULT_LAYOUT };
    settings.value = { ...DEFAULT_SETTINGS, hidden: [] };
    try {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // Nothing stored to clear.
    }
  }

  const isHidden = (piece: PartyPieceId) => settings.value.hidden.includes(piece);

  function setHidden(piece: PartyPieceId, hidden: boolean) {
    const rest = settings.value.hidden.filter((id) => id !== piece);
    settings.value = { ...settings.value, hidden: hidden ? [...rest, piece] : rest };
    save();
  }

  function setChoiceStyle(choiceStyle: ChoiceStyle) {
    settings.value = { ...settings.value, choiceStyle };
    save();
  }

  return { layout, settings, editing, snap, category, selected, place, save, reset, isHidden, setHidden, setChoiceStyle };
}
