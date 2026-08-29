# Feature: Glass surface, automatic with ambient mode

**From build-plan:** feature 24
**Status:** verified

## Goal

Originally spec'd as a standalone Theme picker in `/settings` (Default /
Glass). Built, then found (by the user, confirmed with real browser
screenshots) to work correctly but read as pointless: a separate theme
switch most of the app barely visibly reacts to. Redirected: drop the
picker entirely. The translucent, frosted-glass surface now applies
automatically, with no user setting at all, whenever ambient mode itself
is on - `/study`'s own ambient toggle (feature 14) and `CardPreviewModal`'s
ambient toggle (feature 20). Ambient mode is already the one place a glass
look has something worth showing through it (the sampled video glow), so
tying the two together removes a redundant setting and makes the pairing
automatic instead of asking the user to turn on two separate things for
one effect.

## In scope

- Plain, unconditional tokens in `main.css` (no attribute-gated theme
  block): `--glass-surface`, `--glass-border`, `--glass-blur` - the same
  translucent/blur values already validated by screenshot in the earlier
  build.
- `StudyMediaPlayer.vue`'s `.player-card` gets an `ambient-glass` class
  bound directly to the component's existing `ambient` prop (no new prop -
  it already receives this from both `/study` and `CardPreviewModal`).
  When present, the class applies `var(--glass-surface)` /
  `var(--glass-border)` / `backdrop-filter: var(--glass-blur)`. No class,
  no blur - matches today's look exactly when ambient mode is off.
- `CardPreviewModal.vue`'s `.panel` gets the same `ambient-glass` class,
  bound to its own existing `ambientMode` ref (the ✨ toggle from feature
  20) - not `:global()`, a plain compound selector fully inside this
  component's own scope.

## Out of scope

- Any standalone theme setting, picker UI, or persisted "theme" preference
  independent of ambient mode - superseded by this redirect.
- Adding `backdrop-filter` blur to any other component (`/cards`, `/decks`,
  `/stats`, the nav bar, buttons, other modals) - unchanged, as in the
  original scope call.
- Changing `CardPreviewModal.vue`'s non-ambient appearance. Its `.panel`
  keeps using `--bg` for its background exactly as before; the
  `ambient-glass` class only applies while `ambientMode` is true.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Theme mechanism + settings picker + token palette**
  (superseded - see Step 3) - built a standalone `useTheme` composable,
  `data-theme="glass"` attribute mechanism, `localStorage` persistence,
  and a `/settings` picker. Verified working via automated browser
  screenshots, but the user redirected the feature away from this design
  before `/complete` - see Goal. Left checked because the work happened
  and its palette values carry forward; the code itself is removed in
  step 3.
- [x] **Step 2 - Frost `/study`'s player and `CardPreviewModal`'s panel**
  (superseded - see Step 3) - added `backdrop-filter` gated by the
  step-1 `data-theme` attribute. Removed and replaced in step 3 with a
  simpler, ambient-prop-driven version that needs no global theme state
  at all.
- [x] **Step 3 - Replace the standalone theme with an ambient-mode-driven
  glass look**
  - `nuxt-app/app/assets/css/main.css`: remove the `--surface-blur` token
    and the `:root[data-theme="glass"]` block from steps 1-2. Add plain,
    always-defined tokens instead: `--glass-surface: rgba(42, 31, 56,
    0.45);`, `--glass-border: rgba(245, 238, 248, 0.14);`,
    `--glass-blur: blur(20px) saturate(1.6);` (same values already
    screenshot-verified in the superseded build).
  - `nuxt-app/app/composables/useTheme.ts`: delete.
  - `nuxt-app/app/layouts/default.vue`: revert to its pre-feature state
    (no `initTheme` call).
  - `nuxt-app/app/pages/settings.vue`: remove the Theme section and the
    `useTheme()` call.
  - `nuxt-app/app/components/study/StudyMediaPlayer.vue`: remove the
    step-2 `backdrop-filter: var(--surface-blur);` line. Add
    `:class="{ expanded, 'ambient-glass': ambient }"` to the root
    `.player-card` div (alongside the existing `expanded` class) and a
    `.player-card.ambient-glass` rule using the three new tokens.
  - `nuxt-app/app/components/card/CardPreviewModal.vue`: remove the
    step-2 `backdrop-filter` line and the unscoped `<style>` block with
    the `:global([data-theme="glass"])` override entirely. Add
    `'ambient-glass': ambientMode` to `.panel`'s existing class binding
    and a `.panel.ambient-glass` rule using the same three tokens - a
    plain scoped compound selector this time, no `:global()` needed.

  *Done when:* `/settings` no longer has any Theme section; turning on
  `/study`'s "Ambient mode" toggle makes the player card visibly
  translucent/frosted (confirmed by computed-style check:
  `backdrop-filter` reads `blur(20px) saturate(1.6)` when ambient is on,
  `none` when off); turning it off returns the card to today's exact
  look; the same holds for `CardPreviewModal`'s ✨ ambient toggle on its
  panel; `bun run build` passes with no leftover references to
  `useTheme` or `data-theme`.

## Files / areas

- `nuxt-app/app/assets/css/main.css` (glass tokens, unconditional now).
- `nuxt-app/app/composables/useTheme.ts` (deleted).
- `nuxt-app/app/layouts/default.vue` (reverted).
- `nuxt-app/app/pages/settings.vue` (Theme section removed).
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` (`ambient-glass`
  class tied to the existing `ambient` prop).
- `nuxt-app/app/components/card/CardPreviewModal.vue` (`ambient-glass`
  class tied to the existing `ambientMode` ref).

## Data / contracts

- None. No settings, no `localStorage` key, no schema/API change - the
  visual state is entirely derived from each component's existing
  ambient-mode state, which already persists (`CardPreviewModal`) or
  resets per session (`/study`) exactly as it did before this feature.

## Testing

- No test runner configured; UI/CSS-only - rides on browser/manual
  evidence. This round used real automated-browser verification
  (Playwright, run ad hoc via `bunx`, not added to the project) rather
  than build-success-only, after the first design's "looks like nothing
  happened" report turned out to be a real usability problem, not a bug -
  worth repeating for the redesign rather than trusting a clean build
  alone.
- Manual check: open `/study`, confirm no visual change with Ambient mode
  off; turn Ambient mode on with a video card and confirm the player card
  now looks translucent/frosted; open a card's Preview from `/cards`,
  toggle its ✨ button, and confirm the same on its panel; confirm
  `/settings` no longer shows any Theme control.

## Notes for the AI

- `ambient-glass` is a plain scoped class in both components - no
  `:global()`, no attribute selectors, no shared document-level state.
  This avoids the exact bug the superseded step 2 had (a `:global()`
  compound selector that silently dropped `.panel` from the compiled
  CSS) by construction, not by care.
- The three `--glass-*` tokens live in `main.css` unconditionally now
  (no `[data-theme]` gate) - they're just palette constants both
  components reference, not part of any switchable theme.
- Don't reintroduce `useState`/`localStorage` for this - ambient mode's
  own existing state (session-only on `/study`, persisted in
  `CardPreviewModal`) is the only state this feature needs, and it
  already exists.

## Step 4 (post-verify amendment) - extend to `StudyInfoPanel` and increase transparency

After step 3 landed, the user reported the effect still barely read as
"glass" - only the video player card was affected, so roughly half of
`/study`'s visible surface (the side info panel) stayed fully opaque
regardless of ambient mode, and the tint was strong enough to mute the
background rather than let it show through.

- [x] `nuxt-app/app/components/study/StudyInfoPanel.vue`: added an
  `ambient?: boolean` prop, `'ambient-glass': ambient` on `.info-card`'s
  class binding, and a matching `.info-card.ambient-glass` rule (same
  three tokens as the other two components).
- [x] `nuxt-app/app/pages/study/index.vue`: pass `:ambient="ambientMode"`
  to `<StudyInfoPanel>`.
- [x] `nuxt-app/app/components/card/CardPreviewModal.vue`: pass
  `:ambient="ambientMode"` to its own `<StudyInfoPanel>` usage too, for
  the same reason.
- [x] `nuxt-app/app/assets/css/main.css`: lowered `--glass-surface`'s
  alpha from `0.45` to `0.2` (more of the ambient color shows through,
  less dark-purple tint dominating it) and nudged `--glass-border` from
  `0.14` to `0.16` alpha (kept panels legible/distinct now that the fill
  is much more transparent).

*Done when:* with ambient mode on and a video playing, both the player
card and the side info panel visibly take on the sampled ambient color
(confirmed via screenshot: a night-sky OP's blue tone clearly bleeds
through both panels, not just a faint border shift); with ambient mode
off, both look pixel-identical to before this feature existed.

Scoping note: `StudyDisplayToggles`, the nav bar, and the Fail/Pass
buttons (`StudyAnswerControls`) were deliberately left opaque - the two
content panels (video card + info card) are the surfaces users actually
read text on, and cover the large majority of the page. Extending further
is a reasonable next ask, not assumed here.

## Step 5 (post-verify amendment) - extend glass to all shared UI chrome

The user asked to extend the effect to "all the UI on screen, including
button and search bar" - the nav bar (persistent across every route) and
its search input aren't reachable by prop from `/study` or
`CardPreviewModal`, so this needed a small shared signal plus a global
CSS layer, not more scoped component classes.

- [x] `nuxt-app/app/composables/useAmbientGlass.ts` (new): a shared
  `useState<boolean>("ambientGlassActive", () => false)` plus
  `setAmbientGlass(value)`, which sets/removes a `data-ambient-glass="true"`
  attribute on `document.documentElement`. Guarded with
  `if (!import.meta.client) return` after updating the state - this app
  runs with SSR on (confirmed the hard way: an unguarded `document` access
  from a `watch(..., { immediate: true })` at setup time crashed with a
  server-side 500, since that watcher's immediate call also fires during
  SSR, where `document` doesn't exist).
- [x] `nuxt-app/app/pages/study/index.vue`: `watch(ambientMode, ...,
  { immediate: true })` syncs into `setAmbientGlass`; `onUnmounted(() =>
  setAmbientGlass(false))` so leaving `/study` clears the flag (verified:
  navigating to `/decks` afterward shows `data-ambient-glass` back to
  `null`, no leakage).
- [x] `nuxt-app/app/components/card/CardPreviewModal.vue`: `watch(() =>
  ambientMode.value && props.open, ...)` - only "active" while the modal
  is both ambient-on and actually open.
- [x] `nuxt-app/app/assets/css/main.css`: a global (unscoped - this is a
  plain stylesheet, not a component) rule block keyed off
  `[data-ambient-glass="true"]`, targeting known class names across
  `NavBar`, `StudyDisplayToggles`, `StudyAnswerControls`,
  `StudyMediaPlayer`, `CardPreviewModal`, and `StudyInfoPanel`:
  `.app-nav`, `.nav-link:not(.active)`, `.nav-search .search-input`,
  `.search-dropdown`, `.display-toggles .toggle-btn:not(.on)`,
  `.answer-btn`, `.expand-btn`, `.close-btn`, `.ambient-btn:not(.active)`,
  `.scrub`, `.lang-btn:not(.on)`. Sets `background`/`backdrop-filter`
  with `!important` (needed - these are equal-specificity ties against
  each component's own scoped rule, decided otherwise by unreliable
  stylesheet load order). Active/on states (`.active`, `.on`) are
  excluded throughout so their distinct highlight colors - which page
  you're on, which toggle is on, which language is shown - stay visible
  instead of blending into generic glass.
- [x] Before writing the selector list, grepped every candidate class
  name across the whole app for collisions - `.toggle-btn` and
  `.search-input` are also used, unrelated to ambient mode, on
  `/decks`, `/stats`, and `/cards/new`. Scoped those two through their
  unique parent container (`.display-toggles`, `.nav-search`) instead of
  the bare class name. Verified by navigating to those exact pages with
  the flag active: both stayed completely unaffected.
*Done when:* with ambient mode on, computed-style checks confirm glass
applied to `.search-input`, an inactive `.toggle-btn`, `.answer-btn`,
`.expand-btn`, and `.scrub`, while `.nav-link.active` keeps its original
(non-glass) accent-pink background; navigating to `/decks` resets
`data-ambient-glass` to absent and leaves its own `.toggle-btn`
unaffected; `/cards/new`'s unrelated `.search-input` stays unaffected;
no console or server errors on any route; `bun run build` clean.

## Step 6 (post-verify amendment) - drop the solid purple fill on active toggles

The user's next gripe: `.toggle-btn.on`/`.lang-btn.on`/`.ambient-btn.active`
(EN/Romaji/JP+Furigana, Hide Video/Hide Info/Start at random
times/Ambient mode, and Preview's ✨ button) painted a solid
`color-mix(in srgb, var(--accent-secondary) 24%, var(--surface-raised))`
purple fill when active - defeating the glass effect on exactly the
buttons most likely to be active, and unwanted even outside ambient mode
("I dont want anything on the screen to have a hard purple background").

- [x] Added `--accent-secondary-glow: rgba(177, 140, 255, 0.45);` to
  `main.css` (same pattern as the existing `--accent-glow`).
- [x] `StudyDisplayToggles.vue`, `StudyInfoPanel.vue`,
  `CardPreviewModal.vue`: removed the `background: color-mix(...)` line
  from `.toggle-btn.on` / `.lang-btn.on` / `.ambient-btn.active`
  entirely - kept `border-color: var(--accent-secondary)` (already
  present) and added `box-shadow: 0 0 14px var(--accent-secondary-glow);`
  so "active" now reads via border + text color (already present) + a
  glow, never a fill.
- [x] `main.css`: removed the `:not(.on)`/`:not(.active)` exclusions for
  `.toggle-btn`, `.lang-btn`, and `.ambient-btn` from the ambient-glass
  block - now that their own rule sets no background, they inherit
  whichever background applies (solid `--surface-raised` normally, glass
  under ambient), same as every inactive button.
  `.nav-link.active` keeps its exclusion and its own accent-pink
  background - it wasn't part of this complaint (pink, not purple) and
  still needs a distinct "which page am I on" signal.

*Done when:* with ambient mode off, an active toggle/language button
shows the same solid `--surface-raised` background as an inactive one,
distinguished only by its purple border, text color, and glow (confirmed
computed-style: `rgb(42, 31, 56)`, no purple fill); with ambient mode on,
that same active button now shows the glass background
(`rgba(42, 31, 56, 0.2)`, blurred) exactly like every other glass
element, with the purple border/glow as the only remaining "active"
signal; confirmed via screenshot that the ambient background visibly
shows through the "Ambient mode" and "EN" buttons even while active.

## Step 7 (post-verify amendment) - drop the Leitner box badge, simplify the answer-key chips

Two more small cleanups from the same review pass.

- [x] `StudyInfoPanel.vue`: removed the `box` prop entirely (only
  consumer was the `.box-badge`/`.pill` "Box N" indicator, deleted from
  the template along with its now-dead CSS rule), and the now-pointless
  `:box="..."` bindings in `study/index.vue` and `CardPreviewModal.vue`.
- [x] `StudyAnswerControls.vue`: the `←`/`→` key chips inside Fail/Pass
  first lost their solid `background: var(--surface-raised)` (same
  "no hard fill" preference as step 6, applied to the one remaining
  spot that still had one), then - a follow-up in the same pass - lost
  the `border: 1px solid var(--border)` that replaced it too, so the
  arrow now sits directly against the button with no chip at all.

*Done when:* `StudyInfoPanel` no longer renders any "Box N" badge, and
its `box` prop is gone from the component and both call sites (grepped
for leftover references before rebuilding); the `.key` span inside
Fail/Pass has no background and no border in any mode (confirmed
computed-style: `background-color: rgba(0, 0, 0, 0)`); `bun run build`
clean; no console or server errors.

## Step 8 (post-verify amendment) - "Song"/"Artist" labels illegible against variable ambient backgrounds

`.label` (used only for the "Song" and "Artist" section labels in
`StudyInfoPanel.vue`) used `--faint` - the lowest-contrast token in the
palette, tuned for the app's normal solid dark background. Once ambient
mode makes the panel translucent, that background varies with whatever
the video is showing (including bright scenes), and `--faint` nearly
vanished against them.

- [x] `StudyInfoPanel.vue`'s `.label`: switched `color` from `var(--faint)`
  to `var(--muted)` (a meaningfully lighter existing token, already used
  by the Romaji subtitle - `.title-block .romaji` - directly above it in
  this same component) for better baseline contrast.
- [x] First tried adding a text-shadow on top of the color change for
  extra robustness against variable ambient backgrounds - the user
  didn't like the look and asked to match the Romaji subtitle's plain
  style instead (no shadow, just the lighter color), so the shadow was
  dropped. `.label` now differs from `.romaji` only in size/weight/
  transform (uppercase, smaller, bolder - its existing structural role
  as a section label), not in color treatment.
- [x] Scoped to `.label` only - not a change to the shared `--faint`
  token itself, so nothing else in the app (e.g. `CardPreviewModal`'s
  edit-form field labels) is affected.

*Done when:* screenshot comparison confirms "SONG"/"ARTIST" read clearly
against an ambient background using the same plain `var(--muted)`
treatment as the Romaji subtitle, with no shadow; still reads correctly,
if a little brighter, against the normal solid dark background;
`bun run build` clean; no console errors.
