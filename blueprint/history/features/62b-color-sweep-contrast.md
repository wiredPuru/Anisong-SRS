# Feature: Hard-coded color sweep + contrast pass

**From build-plan:** feature 62b (parent: 62. Cute/moe soft retheme)
**Status:** verified

## Goal

Finish the retheme 62a started. 62a changed token values, so every surface
that reads a token already looks cute/moe, but 17 color literals, a handful of
pixel radii, and the browser's own form-control and focus colors still carry
the Akiba Neon look (violet-black scrims, a lavender visualizer mask, blue
checkboxes, 3px badges). This sweep moves them onto tokens, then checks every
screen for legibility on the new warm ground and fixes the pairs that fail.

## Design reference

- `blueprint/reference/cute-moe-soft-retheme/RoseSkyTokens.dc.html` - the
  locked Option B palette, the source for every new token's hue.
- `blueprint/reference/cute-moe-soft-retheme/Main.dc.html` (Study),
  `RoseSkyCards.dc.html`, `RoseSkyDecks.dc.html` - the screens in use.

None of the artboards draw a modal scrim, the player veils, or the record, so
those values are derived from the existing tokens (the warm brown-black
`20, 16, 12` already used by `--shadow-soft`, and cream `235, 219, 178` from
`--glass-border`) rather than read off an image.

## In scope

- **Color literals -> tokens** (full inventory, from `grep`):

  | File | Line | Literal | Role |
  |---|---|---|---|
  | `CardPreviewModal.vue` | 363 | `rgba(10, 6, 15, 0.7)` | modal backdrop |
  | `StudySessionLogModal.vue` | 64 | same | modal backdrop |
  | `StudyAutoRevealSettingsModal.vue` | 76 | same | modal backdrop |
  | `CardAddArtistResults.vue` | 528 | same | modal backdrop |
  | `DeckAddAnimeModal.vue` | 274 | same | modal backdrop |
  | `StudyMediaPlayer.vue` | 1322 | `rgba(10, 6, 15, 0.45)` | paused veil |
  | `StudyMediaPlayer.vue` | 1346 | `rgba(53, 15, 15, 0.6)` | error veil |
  | `StudyMediaPlayer.vue` | 1406 | `rgba(7, 7, 13, 0.72)` | loading-status pill ground |
  | `StudyMediaPlayer.vue` | 1228 | `rgba(255, 255, 255, 0.06)` x2 | record groove texture |
  | `StudyMediaPlayer.vue` | 1230 | `rgba(0, 0, 0, 0.6)` | record drop shadow |
  | `StudyMediaPlayer.vue` | 1259 | `rgba(255, 255, 255, 0.15)` | spindle-hole ring |
  | `StudyMediaPlayer.vue` | 695 | `"rgba(200, 170, 255, 0.9)"` (canvas JS) | visualizer ring mask |
  | `StudyInfoPanel.vue` | 377-378 | `rgba(0, 0, 0, 0.85/0.9)` | overlay text shadow |
  | `StudyAutoRevealCountdown.vue` | 98-99 | same | overlay text shadow |

- **Leftover pixel radii** that should follow the theme: `/cards`' `.badge`
  (VID/AUD pills, 3px) and `.cover-thumb` (3px), Home's `.weak-deck-cover`
  (3px), and the two literal `999px` values (`NavBar.vue:125`,
  `settings.vue:467`).
- **Native form controls**: checkboxes and the volume range still render in
  browser blue/grey wherever `accent-color` is unset (`DeckMembershipPanel`,
  `SettingsNewCardLimitControl`, the `/decks` export "include audio" box,
  `CardPreviewModal`'s edit form).
- **Contrast pass** on every screen (`/`, `/study`, `/cards`, `/decks`,
  `/stats`, `/settings`, plus `CardPreviewModal`): text, badges, focus rings,
  active tabs, pass/fail. Known failures going in:
  - `--faint` on `--surface-raised` is **3.89:1** (below 4.5:1).
  - **No global focus ring.** Only two components style `:focus-visible`;
    everything else shows the browser's blue default, and 13 rules set
    `outline: none` (most replace it with a border-color change, which needs
    checking one by one).

## Out of scope

- Layout, data, route, or behaviour changes (feature 62 is a retheme only).
- Re-weighting the 157 declarations at 700-900 that render with Klee One's
  600 face. If the step 5 screenshots show a title reading too faint, record it
  in the review packet as a follow-up rather than sweeping weights here.
- Radii that are intentionally not theme corners: `50%` circles, `border-radius:
  0` resets, the 5px-wide `.eq-bar` (3px), and `/stats` chart bars (2px) - these
  are shapes, not panel corners.
- Text shadows in `main.css` or elsewhere that already use tokens.
- A light theme. The app has one dark look.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Scrim token + modal backdrops** - add `--scrim` to `main.css`
  and point all five modal backdrops at it. *Done when:* `grep -rn "rgba(10, 6,
  15, 0.7)" nuxt-app/app` returns nothing; opening Preview on a `/decks` detail row, the
  session log (`L`) and Auto Reveal settings on `/study`, an Artist result on
  `/cards`, and Add anime on a created deck each shows a warm brown-black
  backdrop (screenshot of at least Preview and the session log); `bun run build`
  passes.
- [x] **Step 2 - Player veil, record, and overlay-text tokens** - add
  `--veil-paused`, `--veil-error`, `--veil-status`, `--record-groove`,
  `--record-hole-ring`, `--record-shadow`, and `--text-shadow-overlay`; use them
  in `StudyMediaPlayer.vue`, `StudyInfoPanel.vue`, and
  `StudyAutoRevealCountdown.vue`. *Done when:* `grep -nE "rgba?\(" ` over those
  three `.vue` files matches only the canvas line handled in step 3;
  screenshots on `/study` show the paused veil (pause a video card), the
  spinning record with a cream groove texture (an audio card), and the error
  veil (a card whose source 404s, or the veil forced with `bun run measure
  --css`); build passes.
- [x] **Step 3 - Visualizer mask color from a token** - replace the canvas
  `strokeStyle` literal with `--accent` read through `getComputedStyle` on the
  player element, resolved once when the visualizer starts (not every frame).
  *Done when:* no color literal remains in `StudyMediaPlayer.vue`'s script; on
  an audio card the ring still carries the cover's color (screenshot); the mask
  itself shows rose when the cover draw is skipped (a local, uncommitted
  one-line skip of the `source-in` draw, reverted before the diff is shown,
  since a failed cover image hides the record entirely and never reaches this
  path); build passes.
- [x] **Step 4 - Native controls and leftover radii** - set `accent-color:
  var(--accent)` and `color-scheme: dark` once globally in `main.css` (the
  latter added in the build: unchecked boxes were white on the dark ground) (removing the now-redundant
  per-component `var(--accent)` declarations, keeping the volume slider's
  deliberate `var(--muted)`); add `--radius-xs` for small thumbnails and use it
  on `.cover-thumb` and `.weak-deck-cover`; move `.badge` to
  `--radius-pill` (overview: "full pills kept for buttons and badges") and the
  two `999px` literals to `--radius-pill`. *Done when:* checked checkboxes on
  `/cards` (row select), the inspector's Decks panel, `/settings`, and the
  `/decks` export box render rose, not blue (screenshots); VID/AUD badges are
  pills; `grep -rnE "border-radius: *(3px|999px)" nuxt-app/app` matches only
  `.eq-bar`; build passes.
- [x] **Step 5 - Contrast and focus pass** - raise `--faint` to at least 4.5:1
  on `--surface-raised` (`#b0a08d` measures 4.56:1 and 5.16:1 on `--surface`;
  confirm it still reads as a step below `--muted`); add one global
  `:focus-visible` ring in `main.css` from a new `--focus-ring` token
  (`--accent-secondary`, 6.6:1+ on every surface); audit the 13 `outline:
  none` rules and restore a visible focus indicator on any that only change
  `border-color` to `--border` (for example `cards/index.vue:1319`, which
  gives keyboard focus no visible change at all). Then take a screenshot of
  each screen and check badges, active tabs, and pass/fail against the ground.
  *Done when:* a contrast table in the review packet lists every text token on
  every surface token at 4.5:1 or better (baseline below), plus ink-on-accent,
  ink-on-pass, ink-on-fail; Tab-key navigation on `/cards` and `/study` shows a
  sky-blue ring on every focused control (screenshots); any title judged too
  faint is recorded as a follow-up, not changed; build and `bun run test` pass.

## Files / areas

- `nuxt-app/app/assets/css/main.css` - new tokens, global `accent-color` and
  `:focus-visible`, `--faint` value.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - veils, record, loading
  pill, visualizer stroke (script + style).
- `nuxt-app/app/components/study/StudyInfoPanel.vue`,
  `StudyAutoRevealCountdown.vue`, `StudySessionLogModal.vue`,
  `StudyAutoRevealSettingsModal.vue`
- `nuxt-app/app/components/card/CardPreviewModal.vue`,
  `CardAddArtistResults.vue`
- `nuxt-app/app/components/deck/DeckAddAnimeModal.vue`
- `nuxt-app/app/components/nav/NavBar.vue`,
  `components/settings/SettingsAutoDownloadControl.vue`
- `nuxt-app/app/pages/cards/index.vue`, `pages/index.vue`, `pages/settings.vue`,
  plus any component whose `outline: none` step 5 corrects.

## Data / contracts

No data, route, or type changes. New CSS custom properties, all in `:root` in
`main.css` (names are the contract; values are starting points to tune while
looking at the screen):

| Token | Starting value |
|---|---|
| `--scrim` | `rgba(20, 16, 12, 0.7)` |
| `--veil-paused` | `rgba(20, 16, 12, 0.45)` |
| `--veil-error` | `rgba(74, 38, 30, 0.6)` (warm terracotta, from `--fail`'s hue) |
| `--veil-status` | `rgba(20, 16, 12, 0.72)` |
| `--record-groove` | `rgba(235, 219, 178, 0.06)` |
| `--record-hole-ring` | `rgba(235, 219, 178, 0.15)` |
| `--record-shadow` | `0 0 30px rgba(20, 16, 12, 0.6)` |
| `--text-shadow-overlay` | `0 2px 8px rgba(20, 16, 12, 0.85), 0 1px 2px rgba(20, 16, 12, 0.9)` |
| `--radius-xs` | `6px` |
| `--focus-ring` | `var(--accent-secondary)` |

Changed value: `--faint` `#a39381` -> about `#b0a08d`.

Baseline contrast (WCAG, computed from 62a's tokens):

| Foreground | sunken | bg | surface | raised |
|---|---|---|---|---|
| `--text` | 11.41 | 10.71 | 9.57 | 8.45 |
| `--muted` | 7.19 | 6.74 | 6.03 | 5.32 |
| `--faint` | 5.26 | 4.93 | 4.41 | **3.89** |
| `--accent` | 7.81 | 7.33 | 6.55 | 5.78 |
| `--accent-secondary` | 8.96 | 8.40 | 7.51 | 6.63 |
| `--pass` | 8.68 | 8.14 | 7.28 | 6.43 |
| `--fail` | 6.22 | 5.83 | 5.22 | 4.61 |
| `--warning` | 9.09 | 8.53 | 7.62 | 6.73 |

Ink (`#2a2826`) on accent 7.33, on pass 8.14, on fail 5.83. `--faint` on
`--surface` (4.41) also fails and is fixed by the same change.

## Testing

- All five steps are styling. No in-scope pure logic is added, so the unit-test
  gate is exempt (`coding-standards.md` Testing); evidence is screenshots,
  `grep` results, and `bun run build`. `bun run test` must still pass before
  `/complete`.
- Step 3's token read is a one-line DOM call inside the canvas draw path, not
  extractable logic worth a test.
- Screenshots: `bun run measure <path> --shot <file>` with the dev server
  running, at 1920x1080 and one narrow size (800x900) for step 5.
- Contrast numbers are computed, not eyeballed (a throwaway script in the
  scratchpad, not a project dependency).

## Notes for the AI

- Components keep referencing `var(--token)` in scoped `<style>` blocks; no
  inline styles, no new color literals outside `:root` in `main.css`.
- Keep token hues inside the Option B palette: warm brown-black for dark
  overlays, cream for light texture, `--fail`'s hue for error. No violet or
  pure black.
- The visualizer's stroke is a mask: `source-in` replaces it with the cover
  image, so its color only shows when the cover cannot be drawn. Do not read
  the token every animation frame.
- `.audio-veil.has-cover` is transparent on purpose (see its comment); do not
  give it a scrim.
- Klee One tops out at 600 and Google serves both fonts as unicode-range
  subsets, so `document.fonts.check()` is not evidence; measure rendered width
  if a font check is needed.
- The volume slider's `accent-color: var(--muted)` is a deliberate quieter
  choice; the global rule must not override it.
- On step 5's `outline: none` audit, rules that swap the outline for a visible
  accent `border-color` or `box-shadow` are already fine; only fix the ones
  that leave focus invisible.
- No em dashes in comments or docs.

## Found during the build

- **`/cards` no longer opens `CardPreviewModal`.** Its inspector has its own
  player; the modal is reached from `/decks` detail rows and Study's
  Previous/session log. Step 1's done-when was reworded to match.
- **`color-scheme: dark` joined `accent-color` on `body` (step 4).** Unchecked
  checkboxes outside `/cards` rendered white on the dark ground; only `/cards`'
  row boxes had set it locally, and that declaration was removed as redundant.
- **The error veil cannot be reached without a broken clip.** It was checked by
  measurement: `--fail` text on `--veil-error` is 5.67:1 over `--surface-sunken`
  and 6.74:1 over black video (was 6.65 and 7.55).
- **No audio-only cards exist in the dev library**, so record and visualizer
  screenshots switched Playback mode to Audio only through
  `POST /api/media-library/playback-mode` and back to `auto` afterwards.
- **Focus audit result.** 12 of the 13 `outline: none` rules are text inputs
  that replace the outline with an accent border and glow on `:focus`; only
  `.import-toggle` hid focus entirely. A Tab-key probe on `/cards` (12 stops)
  and `/study` (16 stops) found the 2px sky ring on every stop, unclipped on
  `/cards` rows.
- **Final contrast, lowest across the four surfaces:** `--text` 8.45, `--muted`
  5.32, `--faint` 4.56 (was 3.89), `--accent` 5.78, `--accent-secondary` 6.63,
  `--pass` 6.43, `--fail` 4.61, `--warning` 6.73.
- **Follow-up, not changed:** the active segment in segmented controls (Decks'
  By title / By artist / Created, Stats' 30d / 90d / All) is marked only by a
  `--surface-raised` fill, 1.13:1 against `--surface`, below the 3:1 usually
  expected for a state indicator. The brighter label carries it today. A
  restyle is a separate `/fix`.
- Klee One's 600 face read legibly at 1920x1080 and 800x900 on every screen, so
  no weight follow-up was raised.
