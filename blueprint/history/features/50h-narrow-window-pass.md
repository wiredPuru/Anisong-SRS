# Feature: Narrow-window pass (Akiba Neon 50h)

**From build-plan:** feature 50h
**Status:** verified

## Goal

Make every Akiba Neon screen (50a-50g) usable in a narrower browser window:
the icon+label rail collapses to icons only, every split-pane layout stacks
into one column, and the Cards table drops its lower-priority columns -
finishing the redesign so no screen requires a wide window to use. Retheme
and relayout only; no behavior, route, or data change.

## Design reference

`blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`,
section `data-screen-label="1a Narrow"` (~line 627). Shows two 520px-wide
examples: the unified Add-card search (rail collapsed to a 56px icon-only
strip, single column) and Study (video, then title/artist/song info, then
Fail/Pass, all stacked in document order, no side panel). It illustrates the
*mechanism* (icon-only rail, single-column stacking), not every screen -
there's no narrow mockup for Decks, Stats, or Settings, so those follow the
same mechanism applied to their own already-built layouts rather than a
pixel reference.

## Existing precedent (load-bearing - build on this, don't invent a new one)

- **The breakpoint is already `820px`.** `layouts/default.vue`'s
  `.app-content` and `pages/study/index.vue`'s `.study-grid` both already
  switch at `@media (max-width: 820px)` (`study-grid` goes
  `grid-template-columns: 1fr 480px` -> `1fr`; `.app-content` goes from a
  fixed `height: 100vh` to `height: auto`, since a stacked pane has nothing
  to size itself against). Every step below reuses this exact breakpoint -
  a second narrow-window threshold anywhere would immediately drift from
  Study's and desync page transitions.
- **The rail's width is already one CSS custom property.**
  `main.css`'s `:root` defines `--rail-width: 82px` with an explicit
  comment: "Anything using `position: fixed` to fill the viewport beside
  the rail insets by `--rail-width` rather than hard-coding 82px."
  `StudyMediaPlayer.vue` (`left: var(--rail-width)`, its expanded/immersive
  overlay inset) and `CardPreviewModal.vue` (same pattern, per its own
  comment) both already consume the token instead of a literal. Redefining
  `--rail-width` inside the existing `820px` media query is therefore a
  one-line change that automatically narrows every one of those insets -
  neither component needs a direct edit.
- **Decks' poster grid needs no change.** `.deck-grid` already uses
  `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`, which
  reflows on its own as the window narrows. Confirmed by reading
  `decks/index.vue` - no explicit breakpoint work is needed there, only
  the header controls (see Step 5).

## In scope

- **Rail collapse.** Below 820px: `NavBar.vue`'s rail narrows and its
  `.nav-label`s hide, leaving icon-only links (matching the mockup's 56px
  rail / 34px icon buttons). `--rail-width` is redefined to match inside
  the same breakpoint in `main.css`, so every consumer of the token
  (`StudyMediaPlayer`, `CardPreviewModal`) follows automatically.
- **Split-pane stacking**, each via `grid-template-columns: 1fr` (or
  equivalent) at `≤820px`, mirroring `.study-grid`'s existing pattern:
  - `/cards`' `.cards-body` (`1fr 400px` -> stacked; list above inspector).
  - `/settings`' rail + content pane (`.section-rail` becomes a horizontal,
    scrollable tab strip instead of a vertical list eating a full column;
    `.section-panels`' 2-column grid collapses to 1).
  - `/` (Home)'s `.dashboard-grid` (`1.55fr 1fr` -> stacked).
- **Cards table drops columns.** Below 820px, `.table-head`/`.card-row`
  hide the `Anime` and `Sources` cells (kept: thumbnail, Song, Due) and
  `grid-template-columns` drops those two tracks to match, so the row
  doesn't leave empty gaps.
- **Stats' KPI row collapses** (`repeat(3, 1fr)` -> a narrower layout that
  doesn't force horizontal scroll - single column or `auto-fit`, decided
  during that step against the actual rendered width).
- **Page-header wrapping.** Every page header built by 50c-50g (Cards,
  Decks, Stats, Settings) that lays its title/search/tabs/buttons out in
  one non-wrapping flex row gets `flex-wrap: wrap` (plus a little
  row-gap) at the same breakpoint, so controls wrap instead of overflowing
  or forcing horizontal scroll. Study's own toggle strip and Home's header
  get the same treatment if the QA sweep (Step 7) finds they need it.
- A final cross-page screenshot sweep (Step 7) at two widths to catch
  anything the per-page steps missed, and fix small stragglers found there.

## Out of scope

- Any new breakpoint value - `820px` only, reused everywhere.
- Modals/dialogs not already tied to `--rail-width` (`DeckAddAnimeModal`,
  artist bulk-import modal, etc.) - not audited here unless Step 7's sweep
  actually catches a real overflow; this feature's scope is the shell,
  rail, and the page-level layouts named above.
- Touch/mobile-specific interaction changes (hover-only affordances,
  tap targets) - this is a width/layout pass, not a touch-input pass.
- Any change to what data loads or what a control does - narrower layouts
  only, byte-for-byte same behavior.
- Cards' inspector auto-scrolling into view on row selection when stacked
  below a long list - a real UX rough edge once stacked, but a new
  interaction (not present today at any width), so it's deferred rather
  than folded into a mechanical stacking pass.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight
   on. Checkpoints are optional; `/complete` makes the real feature-level
   commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the
step was too big, so split it.

## Build steps

- [x] **Step 1 - Rail + shell foundation** - In `main.css`, redefine
  `--rail-width: 56px` inside a `@media (max-width: 820px)` block (new or
  merged with an existing one). In `NavBar.vue`, add a matching
  `@media (max-width: 820px)` in its scoped style that hides `.nav-label`
  and shrinks `.nav-logo`/`.nav-link`/`.nav-icon` to the mockup's
  icon-only sizing (~34px links, tighter gaps/padding) so the rail's
  visual width matches the new `--rail-width`. *Done when:* at a viewport
  ≤820px wide, the rail shows icons only (no labels) at the narrower
  width on every page (shared layout) - individual pages' own content may
  still overflow narrower than 820px at this point, that's fixed in their
  own steps below; only the rail itself is asserted here - `/study`'s
  expanded/immersive overlay and `CardPreviewModal`'s expanded view still
  inset correctly beside the narrower rail (screenshot both), and nothing
  above 820px changes (screenshot one page at 1440px unchanged).
- [x] **Step 2 - Home narrow stacking** - Add `@media (max-width: 820px)`
  to `pages/index.vue`: `.dashboard-grid` collapses to
  `grid-template-columns: 1fr` (hero panel already spans both columns via
  `grid-column: 1 / -1`, so it needs no change - the stats card and
  weakest-decks card stack in document order); the header row gets
  `flex-wrap: wrap`. *Done when:* Home at 480px and 768px shows the hero,
  then stats, then weakest-decks stacked with no horizontal scroll or
  overlapping content; screenshot both widths.
- [x] **Step 3 - Study narrow verification + polish** - `.study-grid`
  already stacks at 820px (pre-existing). Verify with the dev server at
  480px/768px: the display-toggle icon strip, language toggles, and
  Pass/Fail controls in the stacked `.side` pane. Add `flex-wrap: wrap` (or
  equivalent) to any row that overflows, and confirm the immersive overlay
  (`E` hotkey) still renders correctly with the Step-1 narrower
  `--rail-width`. *Done when:* screenshots at both widths show no
  horizontal scroll or clipped controls in normal and immersive mode.
- [x] **Step 4 - Cards narrow stacking + column drop** - Add
  `@media (max-width: 820px)` to `pages/cards/index.vue`: `.cards-body`
  collapses `1fr 400px` to `1fr` (list pane above the inspector, matching
  `.study-grid`'s pattern); `.table-head`/`.card-row` hide `.cell-anime`
  and `.cell-sources` (and the header's matching `<span>Anime</span>`/
  `<span>Sources</span>`) and `grid-template-columns` drops to
  `46px 1fr 92px` (thumbnail, Song, Due); the header row gets
  `flex-wrap: wrap`. *Done when:* Cards at 480px/768px shows a 3-column
  table (thumbnail/Song/Due only), the inspector appears below the list
  once a card is selected, and the header doesn't overflow; screenshot
  both widths, list and a selected-card inspector state.
- [x] **Step 5 - Decks + Stats narrow pass** - Add
  `@media (max-width: 820px)` to both `pages/decks/index.vue` (header
  `flex-wrap: wrap`, including the tab segmented control and the 230px
  search input shrinking to `100%`/`flex: 1`; the poster grid needs no
  change per the existing-precedent note above) and
  `pages/stats/index.vue` (`.kpi-row` from `repeat(3, 1fr)` to a layout
  that doesn't force horizontal scroll at 480px, plus header
  `flex-wrap: wrap`). *Done when:* Decks (list and a deck's detail view)
  and Stats at 480px/768px show no horizontal scroll and no overlapping
  controls; screenshot all four states.
- [x] **Step 6 - Settings narrow stacking** - Add
  `@media (max-width: 820px)` to `pages/settings.vue`: `.settings` switches
  from a row to a column, `.section-rail` becomes a horizontal
  `overflow-x: auto` strip (`flex-direction: row`, `width: 100%`,
  `border-right` replaced with a `border-bottom`) instead of a 210px
  vertical column, and `.section-panels`' `repeat(2, minmax(0,1fr))` grid
  collapses to one column. *Done when:* Settings at 480px/768px shows the
  five section labels as a horizontally scrollable strip above the
  content pane, every section's panels stack in one column, and switching
  sections still works; screenshot the Media library and one other
  section at both widths.
- [x] **Step 7 - Cross-page QA sweep** - With every prior step built,
  screenshot all seven screens (Home, Study normal, Study immersive,
  Cards list+inspector, Decks list+detail, Stats, Settings) at 480px and
  768px in one pass. Fix any remaining horizontal scroll, clipped
  control, or overlap the per-page steps missed (small, targeted CSS
  fixes only - no new structural changes). *Done when:* every screenshot
  in the sweep shows no horizontal scrollbar and no visibly clipped or
  overlapping control.

## Files / areas

- `nuxt-app/app/assets/css/main.css` - `--rail-width` breakpoint override.
- `nuxt-app/app/components/nav/NavBar.vue` - icon-only rail styling.
- `nuxt-app/app/pages/index.vue`, `pages/study/index.vue`,
  `pages/cards/index.vue`, `pages/decks/index.vue`, `pages/stats/index.vue`,
  `pages/settings.vue` - one `@media (max-width: 820px)` block added to
  each (Study's already exists and gets verified/extended only if needed).
- No component under `components/` is expected to need a direct edit
  (`StudyMediaPlayer.vue`/`CardPreviewModal.vue` inherit the rail-width
  change automatically); Step 7 may surface a small exception.

## Data / contracts

None. Pure CSS/layout; no script logic, route, or data shape changes on any
page.

## Testing

No test runner is configured, and this is a pure CSS/layout change - no new
logic to unit test. Verify with the dev server and the `measure` script
(`bun run measure <path> --size <W>x<H> ...`, per `AGENTS.md`'s Commands
section) at 480px and 768px for every screen touched, plus a spot check at
1440px per step to confirm nothing above 820px regressed. Screenshot
evidence is the done-when for every step above.

## Notes for the AI

- Reuse `820px` everywhere - do not introduce a second breakpoint value.
  If a specific page's content genuinely needs to switch earlier or later,
  stop and flag it rather than silently picking a new number.
- Redefine `--rail-width` at the token level (Step 1) rather than touching
  `StudyMediaPlayer.vue`/`CardPreviewModal.vue` directly - that's the whole
  point of the existing token convention documented in `main.css`.
- Match `.study-grid`'s existing stacking pattern (`grid-template-columns:
  1fr` inside `@media (max-width: 820px)`) for every other split-pane
  collapse, so the app has one consistent mechanism rather than a
  different technique per page.
- Keep every step CSS-only (plus, for Cards, hiding two existing template
  spans - no new markup, no new script state). If a step turns out to need
  a script change beyond that, stop and flag it before continuing - that
  would mean the step was under-scoped.
- Settings' rail-to-horizontal-strip treatment is the one page-specific
  design call in this spec (everywhere else reuses Study's stacking
  pattern exactly) - a 210px vertical list stacked *above* a content pane
  would push every panel below the fold on a short narrow window, which a
  horizontal strip avoids while still following the same
  "collapse-to-icons-or-a-strip" spirit as the rail itself.
