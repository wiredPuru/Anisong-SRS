// Party display themes the host picks in Settings > Themes. Each look lives in
// its own stylesheet under app/assets/css/, keyed by `rootClass` on the display
// root; `decor` names the extra layer PartyThemeDecor draws behind the pieces.
// To add a theme: add its id to DISPLAY_THEMES in server/utils/partyGame.ts,
// add an entry here, write its stylesheet, and import it in pages/party/display.vue.

export const PARTY_THEME_IDS = ["neutral", "glass", "moe", "christmas"] as const;
export type PartyDisplayTheme = (typeof PARTY_THEME_IDS)[number];
export type PartyThemeDecor = "none" | "moe" | "christmas";

export interface PartyTheme {
  id: PartyDisplayTheme;
  label: string;
  hint: string;
  /** Seasonal themes are grouped apart from the everyday ones. */
  season: string | null;
  rootClass: string;
  decor: PartyThemeDecor;
  /** Google Fonts families the theme needs beyond the app's own. */
  fonts: readonly string[];
  /** Colors for the picker's preview: background, panel, accent, text. */
  swatch: readonly [string, string, string, string];
}

export const PARTY_THEMES: readonly PartyTheme[] = [
  {
    id: "neutral",
    label: "Neutral",
    hint: "Black and white, near-solid panels.",
    season: null,
    rootClass: "theme-neutral",
    decor: "none",
    fonts: [],
    swatch: ["#000000", "#141414", "#ffffff", "#ffffff"],
  },
  {
    id: "glass",
    label: "Glass",
    hint: "Frosted see-through panels over the picture.",
    season: null,
    rootClass: "theme-glass",
    decor: "none",
    fonts: [],
    swatch: ["#2a3346", "rgba(8, 8, 12, 0.6)", "#ffffff", "#ffffff"],
  },
  {
    id: "moe",
    label: "Moe",
    hint: "The pink and purple Y2K party look.",
    season: null,
    rootClass: "moe-theme",
    decor: "moe",
    fonts: ["Mochiy Pop One"],
    swatch: ["#2b1243", "#241539", "#ff5fa8", "#ffffff"],
  },
  {
    id: "christmas",
    label: "Christmas",
    hint: "90s moe holiday: snow, lights and festive panels.",
    season: "Winter",
    rootClass: "theme-christmas",
    decor: "christmas",
    fonts: ["Mochiy Pop One"],
    swatch: ["#0f3d26", "#fffaf0", "#e23a4e", "#20352a"],
  },
];

export const DEFAULT_PARTY_THEME: PartyDisplayTheme = "neutral";

export function partyTheme(id: string | null | undefined): PartyTheme {
  return PARTY_THEMES.find((theme) => theme.id === id) ?? PARTY_THEMES.find((theme) => theme.id === DEFAULT_PARTY_THEME)!;
}

/** One Google Fonts stylesheet URL for the given families, or null when none are needed. */
export function partyThemeFontsUrl(fonts: readonly string[]): string | null {
  if (!fonts.length) return null;
  const families = fonts.map((name) => `family=${name.trim().replace(/\s+/g, "+")}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
