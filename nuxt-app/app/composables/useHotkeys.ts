import {
  actionForEvent,
  applyBinding,
  HOTKEY_STORAGE_KEY,
  hotkeyHint,
  parseStored,
  resetBinding,
  resolveBindings,
  serializeOverrides,
  type ApplyResult,
  type HotkeyActionId,
  type HotkeyBindings,
  type HotkeyEventLike,
  type HotkeyScope,
  type HotkeySlot,
} from "~/utils/hotkeys";

function readStored(): HotkeyBindings {
  try {
    return parseStored(localStorage.getItem(HOTKEY_STORAGE_KEY));
  } catch {
    return resolveBindings();
  }
}

// One listener for the whole page, however many components call useHotkeys().
let syncing = false;

/** The one set of hotkey bindings Study, Listen, Preview and Settings share. */
export function useHotkeys() {
  const bindings = useState<HotkeyBindings>("hotkeyBindings", () => resolveBindings());

  function refresh() {
    if (!import.meta.client) return;
    bindings.value = readStored();
    if (syncing) return;
    syncing = true;
    window.addEventListener("storage", (event) => {
      if (event.key === HOTKEY_STORAGE_KEY || event.key === null) bindings.value = readStored();
    });
  }

  function save(next: HotkeyBindings) {
    bindings.value = next;
    try {
      localStorage.setItem(HOTKEY_STORAGE_KEY, serializeOverrides(next));
    } catch {
      // Storage can be unavailable; the bindings still hold until the page reloads.
    }
  }

  function setBinding(id: HotkeyActionId, slot: HotkeySlot, key: string | null): ApplyResult {
    const result = applyBinding(bindings.value, id, slot, key);
    if (result.ok) save(result.bindings);
    return result;
  }

  function reset(id: HotkeyActionId): ApplyResult {
    const result = resetBinding(bindings.value, id);
    if (result.ok) save(result.bindings);
    return result;
  }

  function resetAll() {
    save(resolveBindings());
  }

  function actionFor(scope: HotkeyScope, event: HotkeyEventLike) {
    return actionForEvent(bindings.value, scope, event);
  }

  function hint(id: HotkeyActionId) {
    return hotkeyHint(bindings.value, id);
  }

  return { bindings, refresh, setBinding, reset, resetAll, actionFor, hint };
}
