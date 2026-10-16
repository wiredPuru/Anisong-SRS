import { PARTY_PALETTE_COMMANDS } from "~/utils/partyPalette";
import { PALETTE_RECENT_KEY, parseRecent, pushRecent } from "~/utils/partyPaletteRecent";

const KNOWN_IDS: ReadonlySet<string> = new Set(PARTY_PALETTE_COMMANDS.map((command) => command.id));

export function isCommandBarShortcut(event: KeyboardEvent): boolean {
  // Either modifier on any platform: harmless, and Ctrl+P is what a headless test sends.
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "p";
}

/** Open state, the Cmd/Ctrl+P shortcut, and the recent picks of the host command bar. */
export function usePartyCommandBar(onOpen: () => void = () => {}) {
  const open = ref(false);
  const recent = ref<string[]>([]);
  const isMac = ref(false);
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

  // Capture phase, so a field's @keydown.stop cannot swallow the shortcut.
  function onKeydown(event: KeyboardEvent) {
    if (!isCommandBarShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (open.value) close();
    else show();
  }

  onMounted(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
    isMac.value = /mac/i.test(platform);
    try {
      recent.value = parseRecent(localStorage.getItem(PALETTE_RECENT_KEY), KNOWN_IDS);
    } catch {
      recent.value = [];
    }
    window.addEventListener("keydown", onKeydown, { capture: true });
  });
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, { capture: true }));

  const shortcutLabel = computed(() => (isMac.value ? "⌘P" : "Ctrl+P"));

  return { open, recent, isMac, shortcutLabel, show, close, remember };
}
