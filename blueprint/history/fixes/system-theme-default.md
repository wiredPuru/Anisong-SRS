# Follow the system theme by default

**Type:** Fix
**Status:** verified

## The problem

Feature 84b made Light the default theme. Until someone picks a theme in
Settings > Appearance, the app renders light even on a machine set to dark
mode. Party mode is worse off: the display (`127.0.0.1:4000`) and host panel
(`:4001`) are different origins from the SRS, so they never see the Settings
choice in `localStorage` and are always light, with no way to change it.

The Light fallback lives in three places that must agree:

- `parseThemePreference` in `app/utils/theme.ts` (missing or junk storage)
- `THEME_BOOT_SCRIPT` in the same file (the `<head>` script that sets
  `data-theme` before first paint)
- `app/composables/useTheme.ts`: `readStoredPreference`'s catch and the
  `useState` initial value

## The fix

Make `"system"` the default preference instead of `"light"`, through one
exported `DEFAULT_THEME_PREFERENCE` constant in `app/utils/theme.ts` that
`parseThemePreference`, the boot script, and `useTheme.ts` all use, so they
cannot drift apart again.

- **Normal mode:** with nothing stored, the app follows the OS light/dark
  setting, and the Settings > Appearance picker shows System selected. An
  explicit Light or Dark choice already in storage is kept as-is.
- **Party mode:** the display and host panel always follow the OS setting,
  since they have no stored choice. `plugins/theme.client.ts` already
  re-applies on an OS switch while the preference is System, so both follow a
  live switch too. No party-specific code or picker is added.
- **No first-paint flash:** the boot script resolves System from
  `prefers-color-scheme` before paint, as it already does for a stored
  `"system"`.
- **Server render:** the server cannot see the OS setting; the `useState`
  initial value only drives the Settings picker's highlighted option, and the
  plugin already replaces it after hydration, so starting it at System matches
  the new default without a hydration mismatch in the rendered theme.

Must not break: stored Light/Dark/System choices, the Settings picker, the
record's always-dark styling, or the dark theme's tokens. No new setting and
no server or database change.

## Build steps

- [x] **1. Default to System.** Add `DEFAULT_THEME_PREFERENCE = "system"`,
  use it in `parseThemePreference`, `THEME_BOOT_SCRIPT`, and `useTheme.ts`,
  fix the stale "starts as light" comment, and update `theme.test.ts` (junk
  and missing storage now resolve to System; the boot script with nothing
  stored follows the OS in both directions).
  **Done when:** `bun run test` passes with the updated cases; with empty
  `localStorage` and the browser emulating dark, `/` and
  `/party/display` render with `data-theme="dark"` from first paint, and with
  light emulated both render light; a stored `"light"` still renders light
  under a dark OS; `bun run build` passes.

## Verify

1. `bun run test` and `bun run build` from `nuxt-app/`.
2. Clear site data for `localhost:3000`, set the OS (or browser dev tools
   emulation) to dark, and load `/`: dark theme, no light flash. Settings >
   Appearance shows System selected. Switch the OS to light: the app follows.
3. Pick Light in Settings, switch the OS to dark: the app stays light.
4. `bun run build` then `bun run party`: the display and host panel follow
   the OS setting and switch live when it changes.
