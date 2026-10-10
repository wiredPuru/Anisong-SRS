export const AMBIENT_STORAGE_KEY = "gaqSrs:studyAmbientMode";

function readStored(): boolean {
  try {
    const stored = localStorage.getItem(AMBIENT_STORAGE_KEY);
    return stored !== null ? stored === "1" : window.innerWidth > 820;
  } catch {
    return false;
  }
}

/** The one Ambient mode preference Study, Listen, Preview, Settings and the page backdrop share. */
export function useAmbientPreference() {
  const enabled = useState<boolean>("ambientPreference", () => false);

  function refresh() {
    if (import.meta.client) enabled.value = readStored();
  }

  function setEnabled(value: boolean) {
    enabled.value = value;
    try {
      localStorage.setItem(AMBIENT_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Storage can be unavailable; the choice still holds until the page reloads.
    }
  }

  return { enabled, refresh, setEnabled };
}
