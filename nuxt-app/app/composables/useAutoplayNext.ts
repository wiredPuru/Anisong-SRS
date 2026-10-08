const STORAGE_KEY = "gaqSrs:autoplayNext";

function readStored(): boolean {
  if (!import.meta.client) return true;
  try {
    return parseAutoplayPreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
}

// One value for Study and Listen. Read when this module loads, so a player
// mounting on the first render already sees the saved choice.
const autoplayNext = ref(readStored());

export function useAutoplayNext() {
  function toggle() {
    autoplayNext.value = !autoplayNext.value;
    try {
      localStorage.setItem(STORAGE_KEY, autoplayNext.value ? "1" : "0");
    } catch {
      // Storage can be unavailable; the toggle still works for this visit.
    }
  }

  return { autoplayNext, toggle };
}
