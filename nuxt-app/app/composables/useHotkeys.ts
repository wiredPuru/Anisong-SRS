import {
  actionForEvent,
  applyBinding,
  HOTKEY_STORAGE_KEY,
  hotkeyHint,
  keysOf,
  parseStored,
  resetBinding,
  resolveBindings,
  serializeOverrides,
  type ApplyResult,
  type HotkeyActionId,
  type HotkeyBindings,
  type HotkeyScope,
  type HotkeySlot,
} from "~/utils/hotkeys";
import { HOTKEY_DIALOG_SELECTOR, spaceYieldsToTarget, type HotkeyTargetLike } from "~/utils/hotkeyTarget";

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

  // Null when Space belongs to the focused control, so callers need no Space rule of their own.
  function actionFor(scope: HotkeyScope, event: KeyboardEvent) {
    const action = actionForEvent(bindings.value, scope, event);
    if (action && event.key === " ") {
      const target = event.target instanceof Element ? (event.target as HotkeyTargetLike) : null;
      const dialogOpen = document.querySelector(HOTKEY_DIALOG_SELECTOR) !== null;
      if (spaceYieldsToTarget(scope, target, dialogOpen)) return null;
    }
    return action;
  }

  // Call when a Space press is acted on, so the focused button is not also clicked or the page scrolled.
  // Firefox clicks a button on Space release, hence the key-up too.
  function claimSpace(event: KeyboardEvent) {
    if (event.key !== " ") return;
    event.preventDefault();
    window.addEventListener("keyup", (up) => {
      if (up.key === " ") up.preventDefault();
    }, { once: true, capture: true });
  }

  function keys(id: HotkeyActionId) {
    return keysOf(bindings.value[id]);
  }

  function hint(id: HotkeyActionId) {
    return hotkeyHint(bindings.value, id);
  }

  return { bindings, refresh, setBinding, reset, resetAll, actionFor, claimSpace, keys, hint };
}
