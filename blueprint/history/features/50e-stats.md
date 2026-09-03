# Feature: Stats dashboard (Akiba Neon 50e)

**From build-plan:** feature 50e
**Status:** verified

## Goal

Replace `/stats`' current centered list layout with the Akiba Neon dashboard
treatment: KPI tiles, a real reviews-and-pass-rate chart, and a by-artist/by-title
breakdown with progress bars - matching the visual language already shipped in
50a-50d (rail nav, tight radii, blue-black + sakura + cyan). Retheme and relayout
only: no new page, no change to what data the app tracks beyond the small,
schema-free stats computations this screen needs to have a real (not fake) chart.

## Design reference

`blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`,
section `data-screen-label="1a Stats"` - open the file in a browser and jump to
that section. It is a high-fidelity layout/spacing reference only (per that
folder's `README.md`): recreate the structure in Vue using this app's existing
component patterns, not by porting the HTML. Cross-check current behavior
against `data-screen-label="..."` sections of `Current UI.dc.html` in the same
folder, and against tokens already live in
`nuxt-app/app/assets/css/main.css` (ported from
`blueprint/reference/akiba-neon-canvas.html` by 50a) rather than the mockup's
inline hex values.

The mockup's `#1a Home`/`Study`/`Cards`/`Decks`/`Settings`/`Narrow` sections and
the `1b`/`2a`/`2b` Study-overlay candidates belong to other build-plan items
(50f, already-shipped 50b, 50g, 50h) or an unrelated open decision about
Study's immersive overlay - out of scope here, ignore them for this spec.

## In scope

- A KPI tile row: **Total reviews**, **Pass rate** (both already computed by
  `getOverallStats()`), and **Streak** (new - consecutive days with at least
  one review, ending today or yesterday).
- A reviews-and-pass-rate chart: daily-bucketed review count (bars) with a
  pass-rate line overlay, over a selectable range (30 days / 90 days / all
  time), backed by a new timeline query.
- A by-artist / by-title breakdown panel: progress bars colored by pass-rate
  tier, replacing today's plain list rows. Reuses the existing artist/anime
  toggle and `/api/stats?type=artist|anime` data - display only changes.
- Preserving today's Refresh button and the two-step "Clear history" confirm
  (feature 29), restyled into the new header instead of the old inline block.
- A new `--warning` amber token in `main.css` for the mid-tier progress-bar
  color (the palette has `--pass` and `--fail` but no third tier yet).

## Out of scope

- **"Avg time to guess"** - shown as a 4th KPI tile in the mockup, but nothing
  in the schema captures per-review timing (`ReviewLog` has no
  "card shown" -> "answered" interval). Adding it means a schema change and
  wiring a timer through the study flow - a real feature, not a redesign. Cut
  it; ship 3 KPI tiles instead of 4.
- **"Export CSV"** - shown as a header control in the mockup. A new capability
  (format, scope, and download mechanism are all undecided) with no existing
  precedent anywhere else in the app. Deferred to a future feature if wanted.
- Changing what `POST /api/stats/clear` clears, or any other stats semantics
  from feature 29 - restyling only.
- `/stats`' empty-state link to `/cards` when there are no decks yet - keep the
  existing behavior and copy, just restyled.
- The narrow-window layout - 50h is the dedicated pass for that across every
  redesigned screen; don't actively break down to a single column, but don't
  solve it here either.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add the `--warning` token** - add `--warning` (and a matching
  `--warning-ink` if needed for text-on-fill use) to the color block in
  `nuxt-app/app/assets/css/main.css`, next to the existing `--pass`/`--fail`
  tokens. *Done when:* the token is defined in `:root` and used nowhere yet
  (no visual change to any page).
- [x] **Step 2 - Extend the stats API: streak + timeline** - in
  `nuxt-app/server/utils/stats.ts`, add `streakDays` to `OverallStats` /
  `getOverallStats()` (computed from distinct `reviewLog.reviewedAt` dates,
  consecutive ending today or yesterday, 0 if no review yesterday or today),
  and add `getReviewTimeline(range: "30" | "90" | "all")` returning daily
  buckets `{ date, totalReviews, passCount, passRate }[]` for reviews in that
  window. Wire a `type=timeline&range=...` case into
  `nuxt-app/server/api/stats.get.ts` (400 on a missing/invalid `range`, same
  pattern as the existing `type` validation). *Done when:*
  `GET /api/stats?type=overall` includes a correct `streakDays`, and
  `GET /api/stats?type=timeline&range=30` returns one entry per day covering
  the last 30 days (verified via `curl` against real review history, or a
  temporarily-seeded one).
- [x] **Step 3 - Rebuild the page shell: header + KPI tiles** - replace
  `/stats`' current centered `.stats` layout with the dashboard shell (full-
  width content area matching `/cards`/`/decks`' post-redesign pattern): a
  header with the page title, a time-range segmented control (30d / 90d /
  All - following the `tab-seg`/`tab-seg-btn` pattern already used on
  `/decks`) wired to a `range` ref, the existing Refresh button, and the
  existing two-step Clear-history confirm - both carried over unchanged in
  behavior. Below the header, a KPI tile row for Total reviews / Pass rate /
  Streak, styled per the design reference. The chart and breakdown panels are
  still the old list at this step. *Done when:* `/stats` shows the new
  header and three KPI tiles with real data (including streak), Refresh and
  Clear history both still work, and the range control changes `range` (chart
  wiring comes next step).
- [x] **Step 4 - Reviews-and-pass-rate chart panel** - add the chart panel
  fetching `type=timeline&range=<range>` (via `useFetch`/`$fetch`, reactive to
  the header's range control, with loading/error/empty states - "No reviews
  yet" when the range has none), rendering daily bars scaled to the max count
  in the window plus an SVG polyline for pass rate, per the design reference.
  *Done when:* the chart renders real data, switching 30d/90d/All reloads it,
  and a fresh install with zero reviews shows the empty state instead of a
  broken/empty chart.
- [x] **Step 5 - By-artist/by-title breakdown panel** - replace the remaining
  old `.stats-list` with the progress-bar panel: keep the existing
  artist/title toggle and `/api/stats?type=artist|anime` fetch, render each
  row as a label + pass-rate progress bar colored by tier (`--pass` at/above
  70%, `--warning` 40-69%, `--fail` below 40%, `--muted`/no bar for "no
  data"), matching the design reference's "By artist" panel. *Done when:*
  both tabs render real rows with correctly tiered colors, and a card/artist
  with zero reviews shows the "no data" state instead of a 0%-filled bar.

## Files / areas

- `nuxt-app/app/assets/css/main.css` - new `--warning` token.
- `nuxt-app/server/utils/stats.ts` - `streakDays`, `getReviewTimeline()`.
- `nuxt-app/server/api/stats.get.ts` - `type=timeline` handling.
- `nuxt-app/app/pages/stats/index.vue` - the whole redesigned template/styles;
  script-side additions for range state and the timeline fetch.

## Data / contracts

- `OverallStats` (server, `stats.ts`) gains `streakDays: number`. Only
  consumer is `/stats`, whose own local `OverallStats` interface mirrors it -
  update both.
- New shape, not previously defined:
  ```ts
  interface ReviewTimelineEntry {
    date: string; // "YYYY-MM-DD"
    totalReviews: number;
    passCount: number;
    passRate: number | null;
  }
  ```
  Returned as `{ entries: ReviewTimelineEntry[] }` from
  `GET /api/stats?type=timeline&range=30|90|all`.
- No schema/migration changes - both additions read `reviewLog.reviewedAt`,
  already stored.

## Testing

No test runner is configured yet (`AGENTS.md` has no `test` command), so this
rides on manual/API verification, not a unit-test gate:

- `curl` (or the browser network tab) against `GET /api/stats?type=overall`
  and `GET /api/stats?type=timeline&range=30|90|all` to confirm real numbers,
  including a zero-review fresh state.
- Manually walk `/stats` in the browser: KPI tiles show real values, the
  chart renders and reacts to the range control, the breakdown panel's tiers
  and "no data" row are visually correct, Refresh and Clear history both
  still work exactly as before.
- Screenshot at a standard desktop width (1440px, matching the design
  reference's artboard) compared against the `1a Stats` mockup section for
  layout fidelity.

If `getReviewTimeline`'s day-bucketing or streak logic ends up non-trivial
once written (date-boundary edge cases), consider it a candidate to revisit
once `/tests` is run and a runner exists - not a blocker for this feature.

## Notes for the AI

- Server-side stats logic (`stats.ts`) is pure SQL aggregation via Drizzle -
  keep `getReviewTimeline`/streak calculation there, not in the API route
  handler, matching the existing `getOverallStats`/`listArtistStats` split.
- `reviewLog.reviewedAt` is a datetime column; bucket by local calendar date
  (`date(reviewedAt)` in SQLite, matching how "today"/"yesterday" should read
  for a single local user) - don't reinvent a UTC-day bucketing that could
  disagree with what the user sees as "today."
- Reuse `/decks`' `tab-seg`/`tab-seg-btn` scoped-style pattern for the new
  time-range control rather than inventing a second segmented-control look -
  no shared component exists for it yet (every redesigned page owns its own
  scoped styles), so copy the pattern, don't extract a component unless it
  turns out trivial.
- Keep the existing `activeType` (artist/title) toggle and its
  `router.push({ query: { type } })` URL-driven pattern for the breakdown
  panel - only the row rendering changes.
- No inline styles (coding-standards.md) - the design reference's HTML is all
  inline `style=` attributes because it's a static mockup; translate every
  value to a scoped `<style>` block using `var(--token)`, same as every other
  redesigned page.
