import { LAST_PLAYED_STORAGE_KEY, parseLastPlayed, type LastPlayed } from "~/utils/lastPlayed";

export function useLastPlayed() {
  const lastPlayed = useState<LastPlayed | null>("lastPlayed", () => null);
  const loaded = useState<boolean>("lastPlayedLoaded", () => false);

  if (import.meta.client && !loaded.value) {
    loaded.value = true;
    try {
      lastPlayed.value = parseLastPlayed(localStorage.getItem(LAST_PLAYED_STORAGE_KEY));
    } catch {
      lastPlayed.value = null;
    }
  }

  function setLastPlayed(value: LastPlayed) {
    lastPlayed.value = value;
    try {
      localStorage.setItem(LAST_PLAYED_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the backdrop still follows this visit.
    }
  }

  return { lastPlayed, setLastPlayed };
}
