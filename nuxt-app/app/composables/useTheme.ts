import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  prefersDarkScheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "~/utils/theme";

export function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function applyTheme(preference: ThemePreference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference, prefersDarkScheme()));
}

export function useTheme() {
  // The server cannot see localStorage, so this starts at the default
  // everywhere; plugins/theme.client.ts swaps in the stored value once
  // hydration is done.
  const preference = useState<ThemePreference>("themePreference", () => DEFAULT_THEME_PREFERENCE);

  function setPreference(next: ThemePreference) {
    preference.value = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    applyTheme(next);
  }

  return { preference, setPreference };
}
