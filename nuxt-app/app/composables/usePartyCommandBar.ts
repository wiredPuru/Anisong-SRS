import { isTyping } from "./usePartyHotkeys";
import { PARTY_PALETTE_COMMANDS, isPaletteShortcut } from "~/utils/partyPalette";
import { PALETTE_RECENT_KEY, parseRecent, pushRecent } from "~/utils/partyPaletteRecent";

const KNOWN_IDS: ReadonlySet<string> = new Set(PARTY_PALETTE_COMMANDS.map((command) => command.id));

/** Open state, the Shift+P shortcut, and the recent picks of the host command bar. */
export function usePartyCommandBar(onOpen: () => void = () => {}) {
  const open = ref(false);
  const recent = ref<string[]>([]);
  let returnFocus: HTMLElement | null = null;

  function show() {
    if (open.value) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onOpen();
    open.value = true;
  }

  function close() {
    if (!open.value) return;
    open.value = false;
    const target = returnFocus;
    returnFocus = null;
    if (target?.isConnected) nextTick(() => target.focus());
  }

  function remember(id: string) {
    recent.value = pushRecent(recent.value, id, KNOWN_IDS);
    try {
      localStorage.setItem(PALETTE_RECENT_KEY, JSON.stringify(recent.value));
    } catch {
      // Recents last until the page reloads.
    }
  }

  // Capture phase, so the bar opens before the hotkeys see a P. Shift+P in a
  // text field is a capital P, including in the bar's own box; Esc closes it.
  function onKeydown(event: KeyboardEvent) {
    if (open.value || event.isComposing || !isPaletteShortcut(event) || isTyping(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) show();
  }

  onMounted(() => {
    try {
      recent.value = parseRecent(localStorage.getItem(PALETTE_RECENT_KEY), KNOWN_IDS);
    } catch {
      recent.value = [];
    }
    window.addEventListener("keydown", onKeydown, { capture: true });
  });
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, { capture: true }));

  return { open, recent, show, close, remember };
}
