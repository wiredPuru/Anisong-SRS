# Feature: Settings redesign (Akiba Neon 50g)

**From build-plan:** feature 50g
**Status:** verified

## Goal

Move `/settings` off its current single 640px-wide scrolling column onto the
Akiba Neon layout: a page-local section rail on the left (Media library,
Study pacing, Playback, Cache, Import & export) and a content pane on the
right that shows one section's controls at a time, matching how `/stats`
(50e) and `/decks` (50d) already fill the content column and use panel/tile
styling. Retheme only - no setting is added, removed, or renamed, and no
server route changes.

## Design reference

`blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`,
section `data-screen-label="1a Settings"` (~line 575). Shows the app's
existing 82px icon rail, then a 210px section list (Media library / Study
pacing / Playback / Cache / Import & export / Appearance), then a content
pane with a header (section title + "Changes save as you go") and a
2-column grid of panels.

Two deliberate deviations from the mockup, both because nothing in the real
app backs them:

- **Drop "Appearance"** from the section list - feature 24 explicitly
  rejected a standalone theme/appearance toggle in favor of ambient mode
  driving glass automatically, so there is no setting to put here.
- **Don't invent settings the mockup implies but the app doesn't have**
  (e.g. its "2 folders - 318 clips found" scan summary, or a folder-level
  clip count). Every panel shows only the real fields already returned by
  `GET /api/media-library` and rendered by the current page and its four
  `Settings*Control.vue` children.
- **Section-to-panel mapping follows the current page's own headings, not
  the mockup's frozen screenshot.** The mockup is one static render, so its
  "Media library" screenshot happens to show the Downloads/Playback/Import
  panels all at once rather than actually reacting to the rail selection -
  useful for spacing/type, not for which fields belong under which rail
  item. Map instead to `settings.vue`'s existing `h2` groupings, which
  already match the rail's own labels one-to-one: Media library (folders +
  download folder), Study pacing (`h2 Study`), Playback (`h2 Playback`),
  Cache (`h2 Streamed clip cache`), Import & export (`h2 Import deck`).

## In scope

- A page-local section rail (own component or inline in `settings.vue`)
  listing: Media library, Study pacing, Playback, Cache, Import & export.
- `?section=` query param on `/settings` selecting the active section
  (default `library` when absent/unrecognized), read on mount and via a
  `watch` (NavBar can link to `/settings` from elsewhere without a
  remount), following the existing `?type=`/`?q=` query-param convention.
- Content pane: a header (section title, matching `/stats`'
  `.stats-header` treatment) plus that section's panel(s), grid-laid-out
  like the mockup and like `/stats`' `.kpi-row`/`.chart-panel`.
- Re-skinning every existing piece of settings UI into that pane:
  - **Media library** - folder list, add-folder form, default-download-folder
    picker (only shown when 2+ folders, same as today).
  - **Study pacing** - `SettingsNewCardLimitControl`,
    `SettingsBoxOneStreakControl`.
  - **Playback** - `SettingsPlaybackModeControl`.
  - **Cache** - `SettingsStreamCacheSizeControl`.
  - **Import & export** - the "Import deck" form (title, hint, path input,
    Import button, summary/error list).
- Porting the panel look (rounded `var(--radius)` panels on `var(--surface)`
  with `var(--border)`, section titles at the mockup's weight/size) to
  match `/stats`' `.chart-panel`/`.breakdown-panel` and `/decks`' panel
  conventions.
- Keeping every existing behavior byte-for-byte: add/remove folder, set
  default download folder, the four `Settings*Control` components' own
  save calls and error handling, deck import and its summary/error
  rendering. None of `settings.vue`'s `<script setup>` logic changes except
  what's needed to read/write `?section=`.

## Out of scope

- Any new setting, field, or API route (no "scan folders" clip-count
  summary, no cache-usage progress bar with real numbers - the mockup's
  "1.2 GB used" bar has no backing data today).
- The four `Settings*Control.vue` components' internal markup/logic - they
  already render as self-contained bordered panels that drop into a grid
  cell unchanged; only their surrounding page layout changes.
- Narrow-window behavior (rail collapsing, panes stacking) - that's 50h.
- Changing how NavBar links to `/settings` (still a plain link; `?section=`
  is a same-page affordance, not a new entry point requirement).

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

- [x] **Step 1 - Section rail shell + Media library section** - Rewrite
  `settings.vue`'s template/script: add `route`/`router`-backed
  `activeSection` (`?section=`, default `library`) with a `setSection()`
  navigator (`router.push({ query: { section } })`, matching `/stats`'
  `setType()` pattern) and a `watch` on the query for external navigation.
  Build the section rail (five items, active one highlighted per the
  mockup's border+tint treatment - no solid fill, consistent with
  `coding-standards.md`'s ambient-glass rule that active states use a
  border/glow) and the content pane's header. Move the Media library
  section's markup (folder list, add-folder form, download-folder picker)
  into a panel shown only when `activeSection === 'library'`; the other
  four sections render an empty pane for now. *Done when:* `/settings`
  shows the rail with five items, clicking "Media library" (or loading
  `/settings?section=library`) shows the folder list/add-folder/download-
  folder UI in the new panel styling, folder add/remove and setting the
  default download folder still work exactly as before, and the URL
  updates via `?section=` without a full navigation/remount.
- [x] **Step 2 - Remaining four sections** - Move Study pacing (both
  `Settings*Control` components), Playback, Cache, and Import & export
  into their own panels in the content pane, each shown only when
  `activeSection` matches, styled consistently with Step 1's panels
  (mirroring the mockup's 2-up grid where it groups Playback + Study
  pacing side by side). Remove the old flat `h1`/`h2`-per-section layout
  and now-unused CSS once every section has moved. *Done when:* clicking
  each of the four remaining rail items shows exactly that section's
  controls and nothing else, every control's existing save/refresh/error
  behavior is unchanged (verified by exercising each: toggle daily-limit,
  change streak requirement, change cache size, change playback mode, run
  an import), and no dead CSS/markup remains from the old single-column
  layout.

## Files / areas

- `nuxt-app/app/pages/settings.vue` - full template/style rewrite, minimal
  script changes (route/query handling only).
- No changes expected to `nuxt-app/app/components/settings/*.vue` (they
  already self-style as bordered panels) or any `server/api/media-library/*`
  route.

## Data / contracts

None. Same `GET /api/media-library` response shape; same four settings
mutation routes, called by the same unchanged child components.

## Testing

No test runner is configured, and this is a pure UI/layout change (no new
logic - `activeSection` is a direct query-param mirror, same shape as
`/stats`' existing `activeType`/`range`). Verify with the dev server: load
`/settings`, click through all five rail items, confirm each section's
controls still save correctly (folder add/remove, default download folder,
daily new-card limit, box-one streak, cache size, playback mode, deck
import), and take a screenshot of at least the Media library and one other
section to compare against the mockup's panel styling.

## Notes for the AI

- Follow `/stats`' (50e) established conventions for this kind of page:
  `flex: 1; min-height: 0` on the root, a `position: sticky`-free header
  bar (`padding: 16px 28px; background: var(--surface-sunken); border-bottom`),
  and a scrollable body (`overflow-y: auto`) below it - `/settings` currently
  has neither and should pick both up.
- The section rail is new (nothing else in the app has a page-local second
  rail yet) - build it plain, matching the mockup's spacing/type rather
  than copying `NavBar.vue`'s icon-rail markup, since this rail is
  text-only with no icons per the mockup.
- Active rail item and active playback-mode option (inside
  `SettingsPlaybackModeControl`, if restyled) must use a border/glow
  treatment, never a solid fill - `coding-standards.md`'s ambient-glass
  rule (`main.css`'s ambient-glass block strips backgrounds via
  `!important`, which would leave near-black `--accent-ink` text on dark
  glass under ambient mode). `/settings` has no ambient mode itself, but
  the rest of the app's convention is border+glow for every active state,
  so match it for consistency even here.
- Keep every `Settings*Control.vue` component untouched - they're already
  self-contained bordered panels (`padding: 16px; border-radius:
  var(--radius-sm); background: var(--surface); border: 1px solid
  var(--border)`) that can drop straight into a grid cell.
