# Feature: Themes and tokens

**From build-plan:** feature 84b (parent 84, Kai mascot overhaul)
**Status:** verified

## Goal

Give the app Kai's look at the token level, in two themes the user picks: a
light Kai theme on the sheet's pink-and-cream ground (the default) and a dark
theme that retunes feature 62's gruvbox palette toward Kai's pinks, plus a
System option that follows the OS.

## Design reference

- `blueprint/reference/mascot-v2/kai-sheet-transparent.png` - palette source:
  sakura pink (CORRECT! lettering), cream banner fill with a pink outline,
  warm brown (GUESS? lettering), periwinkle blue (WRONG...), candy yellow
  stars, pink music notes.
- Feature 62's tokens in `main.css` are the dark theme's starting point.

## In scope

- **Tokens** in `main.css`: `:root` carries the light Kai palette and every
  theme-independent token; `:root[data-theme="dark"]` overrides the palette.
  Every text token clears 4.5:1 on every surface in both themes, and each ink
  token clears 4.5:1 on its fill. New tokens: `--star` and `--note` (sheet
  decoration colors), `--outline` (the sheet's soft pink outline on banners and
  pills), and `color-scheme` per theme. The record tokens stay dark in both
  themes (it is a black disk); the veils, scrim, `--text-shadow-overlay`, and
  glass tokens become theme-aware, so each theme's own `--text` and `--fail`
  stay readable on them. (As built, this replaced a planned `--overlay-text`
  token: tinting the veils per theme fixed the same problem without touching
  component CSS.)
- **Fonts**: Mochiy Pop One (chunky rounded, Japanese-capable, closest to the
  sheet's lettering) for display, Zen Maru Gothic (400/500/700, rounded,
  Japanese-capable) for body, replacing Yusei Magic and Klee One.
- **Theme switch**: `app/utils/theme.ts` - `ThemePreference` (`light`,
  `dark`, `system`), `parseThemePreference`, `resolveTheme`, the storage key
  `gaqSrs:theme`, and `THEME_BOOT_SCRIPT`, an inline `<head>` script built
  from the same constants that sets `data-theme` on `<html>` before first
  paint. `useTheme()` reads and writes the preference; a client plugin follows
  OS changes while the preference is System. Stored per browser in
  `localStorage`, like the volume and ambient preferences; a failing or
  blocked storage falls back to light.
- **Settings > Appearance**: a new section, after Playback (the rail's
  default stays Media library), with a three-way picker
  (Light / Dark / System), each option showing a small swatch of its palette.

## Out of scope

- Restyling component shapes (outlined pills, banners, player chrome) - 84c
  to 84e. This step changes values, not component CSS, except where a
  component hard-codes a dark-only assumption that makes text unreadable in the
  light theme.
- A server-side stored theme. The preference is a per-browser UI convenience.

## Data / contracts

- `localStorage["gaqSrs:theme"]` = `"light" | "dark" | "system"`; anything
  else reads as `light`.
- `<html data-theme="light" | "dark">` - always a resolved theme, never
  `system`.

## Build steps

- [x] **Step 1 - Theme logic + boot script** - `app/utils/theme.ts` with
  tests, `useTheme()`, the client plugin, and the head script in
  `nuxt.config.ts`. *Done when:* tests cover parse (valid, junk, null),
  resolve (each preference with OS light and dark), and the boot script
  setting the attribute from a stubbed storage and matchMedia, including a
  throwing storage; `bun run test` passes.
- [x] **Step 2 - Light and dark token sets + fonts** - *Done when:* a
  contrast script over both palettes reports every text token at 4.5:1 or more
  on every surface; `bun run build` passes; screenshots of Home, Study, Cards
  in both themes show readable text and no dark-only leftovers.
- [x] **Step 3 - Settings > Appearance** - *Done when:* picking Dark on
  `/settings?section=appearance` switches the page immediately, survives a
  reload with no light flash (the attribute is present in the first HTML the
  browser paints, via the head script), and System follows the emulated OS
  scheme.

## Testing

`theme.ts` is pure logic and gets `theme.test.ts`. The token sets, fonts, and
Settings control are UI and ride on screenshots and the build.

## Evidence

- `bun run test`: 82 files, 1289 tests passed (8 new in `theme.test.ts`,
  including the boot script run against stubbed storage and matchMedia and a
  throwing storage). `bun run build` passed.
- Contrast script over both palettes: every text token at 4.5:1 or more on
  `--bg`, `--surface`, `--surface-raised`, and `--surface-sunken`; lowest light
  pair `--accent` on `--surface-sunken` 4.54, lowest dark pair `--faint` on
  `--surface-raised` 4.76. Inks on fills: light 4.96-6.17, dark 6.9-9.3.
- Screenshots (production build, `playwright-cli`) of Home, Study, Cards in
  both themes: readable everywhere. One light-theme leftover found and fixed:
  the player's "Paused" text sat in `--text` on a dark veil, so the veils
  became theme-aware.
- `/settings?section=appearance`: clicking Dark sets `data-theme="dark"` and
  stores `dark`; a reload keeps it (the boot script is in the served `<head>`,
  so the attribute exists before first paint); System resolved to light in a
  light-scheme browser. A direct load with `dark` stored first showed Light
  highlighted, because `useState` hydrates the server's `light`; the plugin now
  reads storage in `onNuxtReady`, and a re-check showed Dark highlighted with
  no hydration warnings.
