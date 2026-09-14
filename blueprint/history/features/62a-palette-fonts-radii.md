# Feature: Palette, fonts, and radii tokens

**From build-plan:** feature 62a
**Status:** verified

## Goal

Swap the Akiba Neon theme for the approved cute/moe soft retheme by changing
the values of the existing tokens in `main.css`, the Google Fonts link, and
removing the rail's logo tile. Nearly every component already styles itself
with `var(--token)`, so this retheme lands across the whole app at once; 62b
then sweeps up the colors still hard-coded inside components.

## Design reference

Canvas: https://claude.ai/code/artifact/5b66c1b4-df8d-40c3-af72-8125b93dd267,
page **Option B · Rose & sky** - the option the user picked on 2026-09-14,
together with the **Yusei Magic + Klee One** font pairing it is drawn in.

Working copies of the artboards live in
`blueprint/reference/cute-moe-soft-retheme/`:

- `RoseSkyTokens.dc.html` - every token value, next to what it replaces.
- `Main.dc.html` - Study.
- `RoseSkyCards.dc.html` - Cards.
- `RoseSkyDecks.dc.html` - Decks.
- `Fonts.dc.html` - the three handwritten pairings; the first one is chosen.

The other files there (`RoseSage*` = Option A, `Twilight*` = Option C) are
unchosen options kept for the record. Do not build from them. The artboards
use inline styles and literal hex values; read values off them, express them
as tokens. Cover art in them is a placeholder.

## In scope

- **Color token values** in `nuxt-app/app/assets/css/main.css`: surfaces,
  text, both accents, review states, inks, glows, `--shadow-soft`, and the
  three glass colors. Same names, new values (Data / contracts).
- **Font swap**: `nuxt-app/nuxt.config.ts`'s Google Fonts link loads Yusei
  Magic and Klee One (400, 600) instead of RocknRoll One and Zen Kaku Gothic
  New; `--font-display` and `--font-sans` point at them.
- **Radii**: `--radius` 6px to 14px, `--radius-sm` 4px to 10px.
- **Remove the rail logo tile**: the `.nav-logo` element and its styles
  (including its 820px override) in `nuxt-app/app/components/nav/NavBar.vue`.
  This is the retheme's one layout change, requested by the user; the rail's
  links simply start at its top padding.
- Update the `main.css` comments that name Akiba Neon, RocknRoll One, or Zen
  Kaku Gothic New so they describe the new theme.

## Out of scope

- **Hard-coded colors inside components** - modal backdrops
  (`rgba(10, 6, 15, 0.7)` in five components), `StudyMediaPlayer`'s veils,
  the visualizer ring's lavender stroke, the record texture, text shadows.
  They stay as they are until **62b**, so a modal backdrop will still read
  slightly purple after this sub-feature ships.
- **Contrast and legibility pass** across every screen, including the one
  weak pair the mockup check found (`--faint` on `--surface-raised`, 3.9:1).
  That is **62b**.
- **Font sizes, spacing, or layout** other than removing the logo. If a
  handwritten face makes text overflow, fix only what this step's checks
  catch and list anything else for 62b; do not resize type app-wide.
- `coding-standards.md`'s stale note about porting tokens from
  `prototypes/theme.css`.
- The stream-cache size control's `font-family: monospace`, which is
  deliberate.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Color tokens** - replace every color value in `main.css`'s
  `:root` with the Data / contracts table, including `--shadow-soft` and the
  glass colors, and update the file's header comment. *Done when:* `bun run
  build` passes; `getComputedStyle(document.documentElement)` on `/study`
  returns `#e8a4bd` for `--accent` and `#a3c9e2` for `--accent-secondary`;
  `main.css` contains none of `#07070d`, `#ff3e88`, `#34e7e4`, `#12121f`; and
  screenshots of `/study`, `/cards`, and `/decks` at 1440x900 show the warm
  charcoal ground with rose and sky accents matching the Option B artboards.

- [x] **Step 2 - Handwritten fonts** - swap the Google Fonts link in
  `nuxt.config.ts` to `family=Yusei+Magic&family=Klee+One:wght@400;600`,
  point `--font-display` at `"Yusei Magic"` and `--font-sans` at `"Klee One"`,
  each with a `"Hiragino Maru Gothic ProN", system-ui, sans-serif` fallback.
  *Done when:* in the running app, `document.fonts` holds at least one
  `loaded` face for both families, and on-page text measures a different width
  in each family than in its fallback (`document.fonts.check` is not used: Google
  splits these Japanese families into ~120 unicode-range subsets loaded on
  demand, so it stays false while unused subsets are unloaded); a `/study`
  screenshot shows Japanese titles and furigana rendered in Klee One; `bun run
  measure` at 1440x900 shows every rail label inside its 60px link and the
  Decks header group not overflowing `.decks-header`; and a grep finds no
  element that sets `var(--font-display)` together with a weight above 400
  (Yusei Magic has one weight, so a bolder request would be faked by the
  browser).

- [x] **Step 3 - Radii** - set `--radius` to `14px` and `--radius-sm` to
  `10px`. *Done when:* `bun run measure` reports those computed
  `border-radius` values on `.info-card` (`--radius`) and a Cards
  `.card-row` (`--radius-sm`), and screenshots of `/study`, `/cards`, and
  `/decks` show no clipped content at the rounder corners (tile due badges,
  the player frame, the inspector's cover).

- [x] **Step 4 - Remove the rail logo** - delete `.nav-logo` from
  `NavBar.vue`'s template, its style block, and its rule inside the 820px
  media query. *Done when:* `.nav-logo` is absent from the rendered DOM at
  1440 and 700 wide; the first rail link sits 18px below the top of the rail
  at 1440 and 14px at 700 (the rail's existing padding); and `bun run build`
  passes.

## Files / areas

- `nuxt-app/app/assets/css/main.css` - token values and comments (steps 1-3).
- `nuxt-app/nuxt.config.ts` - Google Fonts link (step 2).
- `nuxt-app/app/components/nav/NavBar.vue` - logo removal (step 4).

## Data / contracts

**Load-bearing: token names do not change.** Every component references these
names; only values change. Tokens not listed (z-index, `--rail-width`,
`--content-max-width`, `--glass-blur`, `--radius-pill`, `--shadow-accent`'s
formula) keep their current values.

| Token | Current | New |
|---|---|---|
| `--bg` | `#07070d` | `#2a2826` |
| `--surface-sunken` | `#0c0c16` | `#252321` |
| `--surface` | `#12121f` | `#32302f` |
| `--surface-raised` | `#16162a` | `#3c3836` |
| `--border` | `#23233c` | `#4a4542` |
| `--text` | `#f2f0ff` | `#ebdbb2` |
| `--muted` | `#8c88b0` | `#bdae93` |
| `--faint` | `#5b5880` | `#a39381` |
| `--accent` | `#ff3e88` | `#e8a4bd` |
| `--accent-strong` | `#ff5470` | `#f0b9cc` |
| `--accent-ink` | `#07070d` | `#2a2826` |
| `--accent-glow` | `rgba(255, 62, 136, 0.35)` | `rgba(232, 164, 189, 0.22)` |
| `--accent-secondary` | `#34e7e4` | `#a3c9e2` |
| `--accent-secondary-ink` | `#07070d` | `#2a2826` |
| `--accent-secondary-glow` | `rgba(52, 231, 228, 0.45)` | `rgba(163, 201, 226, 0.3)` |
| `--pass` | `#46e39b` | `#b3c98a` |
| `--pass-ink` | `#071a12` | `#2a2826` |
| `--fail` | `#ff5470` | `#e98a72` |
| `--fail-ink` | `#1f0910` | `#2a2826` |
| `--warning` | `#ffd166` | `#e6c07b` |
| `--warning-ink` | `#241a02` | `#2a2826` |
| `--shadow-soft` | `0 8px 24px rgba(0, 0, 0, 0.45)` | `0 8px 24px rgba(20, 16, 12, 0.35)` |
| `--glass-surface` | `rgba(22, 22, 42, 0.2)` | `rgba(50, 48, 47, 0.2)` |
| `--glass-surface-panel` | `rgba(22, 22, 42, 0.82)` | `rgba(50, 48, 47, 0.82)` |
| `--glass-border` | `rgba(242, 240, 255, 0.16)` | `rgba(235, 219, 178, 0.16)` |
| `--font-display` | `"RocknRoll One", ...` | `"Yusei Magic", "Hiragino Maru Gothic ProN", system-ui, sans-serif` |
| `--font-sans` | `"Zen Kaku Gothic New", ...` | `"Klee One", "Hiragino Maru Gothic ProN", system-ui, sans-serif` |
| `--radius` | `6px` | `14px` |
| `--radius-sm` | `4px` | `10px` |

Contrast measured on the mockup values (WCAG): text on surface 9.6:1, muted
6.0:1, faint 4.4:1, accent 6.5:1, sky 7.5:1, fail 5.2:1, pass 7.3:1, ink on
accent 7.3:1, ink on sky 8.4:1.

No data model, route, or API change.

## Testing

- No in-scope logic: this sub-feature changes CSS values, a font URL, and one
  template element, so the unit-test gate does not apply and no test is added.
  `bun run test` must still pass, and `bun run build` must pass after every
  step.
- UI evidence per step, as listed in each done-when: computed-style checks
  and `bun run measure` numbers (Playwright is not a dependency; see
  AGENTS.md), plus screenshots of `/study`, `/cards`, and `/decks` compared
  against the Option B artboards.
- Regression to eyeball in the final screenshots: the pass/fail answer
  buttons still read as fail-coral and pass-olive, active states (nav item,
  `Ambient` toggle, By title tab) are still distinguishable, and the ambient
  glow on `/study` still renders.

## Notes for the AI

- Values only. Do not rename tokens, add new ones, or change which token a
  component uses; that is how a retheme stays one reviewable diff.
- Weights: 138 declarations use 700 and 19 use 800 or 900. Klee One's
  heaviest face is 600, so browsers render those with the 600 face; that is
  expected, not a bug to fix here.
- The packaged build already loads Google Fonts at runtime, so swapping the
  families changes nothing about offline behaviour; the fallback stack is what
  shows without network.
- Japanese text must stay real, selectable DOM text (UI/UX section of the
  overview). A font swap does not affect that, but check the furigana in the
  step 2 screenshot.
- Styles stay in scoped `<style>` blocks using `var(--token)`; no inline
  styles; no em dashes in comments.

## Found during the build, for 62b

- **Native form controls still use browser colors.** Checkboxes (the Cards
  table's row and header boxes, the inspector's Decks panel) render in the
  browser's default blue and grey; nothing sets `accent-color`. Not in 62b's
  original list of hard-coded colors, but the same kind of gap.
- **Seven hard-coded `border-radius` pixel values** in components did not pick
  up the new radii. The visible one is `/cards`' `.badge` (the VID/AUD source
  pills) at 3px, now sharper than everything around it.
- **Klee One tops out at 600**, so the 157 declarations at 700-900 render
  noticeably lighter than under Zen Kaku Gothic New (compare Cards song
  titles). If titles read too faint, 62b's legibility pass is where to adjust.
- **`--faint` on `--surface-raised` is 3.9:1**, the one pair under 4.4:1 from
  the mockup check.
- `document.fonts.check()` cannot verify these Google Fonts families (see step
  2's done-when), so any later font check should measure rendered width
  instead.
