import { DEFAULT_PINS, parsePins, PIN_LIMIT, PINS_STORAGE_KEY, togglePin } from "~/utils/partyHostPins";

/** The host's pinned controls, shared by More options and the pinned grid, kept in this browser. */
export function usePartyHostPins() {
  const pins = useState<string[]>("partyHostPins", () => [...DEFAULT_PINS]);
  const loaded = useState("partyHostPinsLoaded", () => false);

  onMounted(() => {
    if (loaded.value) return;
    loaded.value = true;
    try {
      pins.value = parsePins(localStorage.getItem(PINS_STORAGE_KEY));
    } catch {
      // Storage can be blocked; the defaults stand.
    }
  });

  function toggle(id: string) {
    pins.value = togglePin(pins.value, id);
    try {
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins.value));
    } catch {
      // The pins still hold until the page reloads.
    }
  }

  const full = computed(() => pins.value.length >= PIN_LIMIT);

  return { pins, toggle, full };
}
