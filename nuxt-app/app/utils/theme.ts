export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "gaqSrs:theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function parseThemePreference(raw: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(raw as ThemePreference) ? (raw as ThemePreference) : "light";
}

export function resolveTheme(preference: ThemePreference, osPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return osPrefersDark ? "dark" : "light";
  return preference;
}

export function prefersDarkScheme(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

export function watchDarkScheme(onChange: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Inlined into <head> by nuxt.config.ts so <html data-theme> is set before the
// first paint; running it from a plugin would flash the light theme on every
// load for a dark-theme user. It cannot import this module, so it is built
// from the same constants rather than hand-copied.
export const THEME_BOOT_SCRIPT = `(function(){var t="light";try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches))t="dark"}catch(e){}document.documentElement.setAttribute("data-theme",t)})()`;
