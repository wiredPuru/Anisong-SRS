# Feature: Home dashboard (Akiba Neon 50f)

**From build-plan:** feature 50f
**Status:** verified

## Goal

Replace `/`'s current five link-cards with the Akiba Neon dashboard treatment:
a header carrying the global search and an Add-card shortcut, a due-cards hero
with session CTAs, a 30-day activity card (chart + streak/learning/mature
counts), and a weakest-decks + recently-added panel - matching the visual
language already shipped in 50a-50e (rail nav, tight radii, blue-black +
sakura + cyan). Retheme and relayout only, built on real data throughout - no
fake/placeholder numbers, and no new capability beyond the small read-only
aggregations this screen needs.

## Design reference

`blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`,
section `data-screen-label="1a Home"` - open the file in a browser and jump to
that section. It is a high-fidelity layout/spacing reference only (per that
folder's `README.md`): recreate the structure in Vue using this app's existing
component patterns, not by porting the HTML. Cross-check tokens against what's
already live in `nuxt-app/app/assets/css/main.css` (ported by 50a, extended
with `--warning`/`--warning-ink` by 50e) rather than the mockup's inline hex
values - `--pass`/`--warning`/`--fail` are already defined, no new tokens
needed here.

The mockup's other sections (`Add card`, `Cards`, `Decks`, `Study`, `Settings`,
`Narrow`) belong to other build-plan items (50c/50d already shipped with their
own interpretation, 50g, 50h) - ignore them for this spec.

## In scope

- **Header**: page title, the existing global search (`NavSearch`, currently
  rendered by `default.vue`'s Home-only topbar strip) relocated into this
  page's own header, and an "+ Add card" link to `/cards` (the app's one
  add-a-card surface since feature 49 - no new add flow here).
- **Hero banner**: due-card count and new-card count for the default ("all")
  study scope, a "Start session" link to `/study` and a "Pick a deck" link to
  `/decks`. Shows an "all caught up" message instead of "0 cards due, 0 new"
  when nothing is due, matching `/study`'s existing empty-state copy.
- **Last 30 days card**: a daily review-count bar chart (reusing the existing
  `getReviewTimeline("30")` data `/stats` already computes), a "`X`% pass ·
  `Y` reviews" summary for that window, and a streak / learning / mature
  count row (streak reuses `getStudyStreak()`; learning/mature are new,
  box-based).
- **Weakest decks panel**: the 3 lowest pass-rate artist/anime groupings
  (pooled together, ranked by pass rate) with a minimum-reviews floor to
  filter noise, tier-colored progress bars (reusing `/stats`' existing
  pass/warning/fail thresholds), and a "See all" link to `/stats`.
- **Recently added panel**: the 3 most recently created cards (song + artist +
  relative time), read-only rows.
- Removing `default.vue`'s Home-only search-topbar special case, since Home
  now carries its own search in its header.

## Out of scope

- **"Roughly N minutes at your usual pace"** - shown in the mockup's hero, but
  nothing in the schema captures per-review timing (`ReviewLog` has no
  "card shown" -> "answered" interval) - the same gap 50e hit and cut for its
  "Avg time to guess" KPI tile. Not added here either.
- A Japanese-kana subtitle next to the page title, shown in the mockup's
  header - no other redesigned page (`/stats`, `/decks`, `/cards`) carries
  one; skip it for consistency with what's actually shipped.
- Click-through from a "Recently added" row to that card's Preview - plain
  read-only rows for this pass. Can be added later without touching the data
  contract.
- Manual decks in the weakest-decks ranking - `/stats`' own by-artist/by-title
  breakdown never included them either (no per-manual-deck stats exist), so
  this doesn't newly introduce that gap.
- Changing what counts as "due" or "new" for study itself - `getDueCardCount`
  and the daily-new-card-limit logic in `server/utils/cards.ts` are read, not
  modified.
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

- [x] **Step 1 - Server aggregation: `/api/home`** - add
  `getDueCardBreakdown(scope: StudyScope): { due: number; new: number }` to
  `server/utils/cards.ts` (reuses `dueCardCondition`; "new" = due cards with
  zero `ReviewLog` rows - `notInArray(card.id, reviewedCardIds)` against the
  same reviewed-card-ids subquery pattern `baseDueCondition` already uses, not
  `box === 1`, since a failed card also resets to box 1 and isn't "new"), plus
  `getCardMaturityBreakdown(): { learning: number; mature: number }` (box 1-2
  = learning, box 3-5 = mature - a new, documented split; there's no existing
  tier concept to match). Add `summarizeTimeline(entries: ReviewTimelineEntry[]):
  { totalReviews: number; passRate: number | null }` to `server/utils/stats.ts`
  (sums `totalReviews`/`passCount` across entries, then derives one rate - never
  average the per-day `passRate` values, that's statistically wrong for
  uneven day-to-day volume) and `getWeakestDecks(limit: number, minReviews:
  number): WeakestDeckEntry[]` (pools artist and anime groupings - same
  `reviewLog`/`card`/`song` joins as `listArtistStats`/`listAnimeStats`, plus
  `anime.coverImageUrl` for anime rows - filters `totalReviews >= minReviews`,
  sorts by `passRate` ascending, takes `limit`). Add
  `server/api/home.get.ts` returning `{ due, cardMaturity, streakDays,
  recentReviews, timeline, weakestDecks, recentCards }` in one call (streak
  via existing `getStudyStreak()`, `timeline`/`recentReviews` via existing
  `getReviewTimeline("30")` + the new `summarizeTimeline`, `weakestDecks` via
  the new function with `limit=3, minReviews=3`, `recentCards` via the
  existing `cardQuery()` ordered by `createdAt` desc, limited to 3). *Done
  when:* `curl localhost:3000/api/home` (dev server running) returns a
  well-formed object with correct values, checked against a real review
  history and against a temporarily-empty one (fresh-install shape: zero
  everywhere, `weakestDecks`/`recentCards` as empty arrays, `passRate: null`).

- [x] **Step 2 - Page shell + header** - rewrite `app/pages/index.vue`'s
  template/script to the dashboard shell (full-width content area matching
  `/cards`/`/decks`/`/stats`' post-redesign pattern): a header with the page
  title, the relocated `<NavSearch>`, and an "+ Add card" `NuxtLink` to
  `/cards`. Fetch `/api/home` via `useFetch` with loading/error states,
  matching every other redesigned page. Remove `showGlobalSearch`/
  `.app-topbar` from `app/layouts/default.vue` (Home now owns its own
  search). The hero/30-days/weakest-decks/recently-added sections render
  placeholder containers for now. *Done when:* `/` shows the new header with
  a working search dropdown and a working Add-card link, no search box
  renders anywhere else in the layout, and loading/error states are visible
  (verify by throttling/breaking the fetch once, then reverting).

- [x] **Step 3 - Hero banner** - build the "READY TO GO" hero spanning the
  content width: "`N` cards due, `M` new" headline sourced from
  `due`/`cardMaturity`... (`due.due`/`due.new`), or "All caught up! Nothing
  due right now." when `due.due === 0` (matching `/study`'s existing
  `sessionComplete` copy), a "Start session" link (`/study`) and a "Pick a
  deck" link (`/decks`). *Done when:* the hero shows real due/new counts that
  match what `/study` reports for the same scope, both links navigate
  correctly, and the zero-due case shows the caught-up message instead of
  "0 cards due, 0 new".

- [x] **Step 4 - Last 30 days card** - bar chart from `timeline` (uniform bar
  color scaled to the day with the most reviews in the window - simpler than
  `/stats`' chart, no pass-rate line overlay), the "`X`% pass · `Y` reviews"
  summary from `recentReviews`, and a stat row for streak / learning /
  mature counts. Empty state ("No reviews yet") when `timeline` has no
  entries. *Done when:* bars are proportionally correct, the summary numbers
  match what `/stats?type=timeline&range=30` reports for the same window, and
  streak/learning/mature values are correct (cross-check streak against
  `/stats`, and learning+mature against the total card count).

- [x] **Step 5 - Weakest decks + Recently added panel** - ranked, tier-colored
  progress-bar rows for `weakestDecks` (same pass/warning/fail thresholds
  `/stats`' breakdown panel already uses - copy the exact cutoffs, don't
  reinvent them), each linking to `/decks?type=<type>&id=<id>`, a "See all"
  link to `/stats`, and an empty state ("Not enough review history yet") when
  the array is empty. Below it, the "Recently added" list from `recentCards`
  (song title + artist name + relative time - "just now" / "`N`h ago" /
  "yesterday" / a short date beyond that), with an empty state ("No cards
  yet.") for a fresh install. *Done when:* both sections render real data
  with correct tiers/colors and working links, "See all" reaches `/stats`,
  and a fresh install (no reviews, no cards) shows the two empty states
  instead of blank or broken panels.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `getDueCardBreakdown`,
  `getCardMaturityBreakdown`.
- `nuxt-app/server/utils/stats.ts` - `summarizeTimeline`, `getWeakestDecks`.
- `nuxt-app/server/api/home.get.ts` - new aggregation route.
- `nuxt-app/app/pages/index.vue` - full redesign (template, script, scoped
  styles).
- `nuxt-app/app/layouts/default.vue` - remove the Home-only search-topbar
  special case.

## Data / contracts

New response shape for `GET /api/home` (consumed only by this page - not
load-bearing for any other feature):

```ts
interface WeakestDeckEntry {
  type: "artist" | "anime";
  id: number;
  label: string;
  coverImageUrl: string | null; // anime rows only; always null for artist rows
  passRate: number; // never null - minReviews filters out "no data" rows
  totalReviews: number;
}

interface HomeDashboard {
  due: { due: number; new: number };
  cardMaturity: { learning: number; mature: number };
  streakDays: number;
  recentReviews: { totalReviews: number; passRate: number | null }; // last 30 days
  timeline: ReviewTimelineEntry[]; // last 30 days, reused from stats.ts, for the bar chart
  weakestDecks: WeakestDeckEntry[]; // limit 3, minReviews 3
  recentCards: CardWithDetails[]; // limit 3, newest first
}
```

No schema/migration changes - every field is derived from `Card`/`ReviewLog`/
`Anime`/`Artist`/`Song` rows that already exist.

## Testing

No test runner is configured yet (`AGENTS.md` has no `test` command), so this
rides on manual/API verification, not a unit-test gate:

- `curl` (or the browser network tab) against `GET /api/home` to confirm real
  numbers, including a temporarily-empty state.
- Manually walk `/` in the browser: header search and Add-card link work, hero
  counts match `/study`, the 30-day card's numbers match `/stats`, weakest
  decks' tiers/links are correct, recently-added shows the right cards in the
  right order.
- Screenshot at a standard desktop width (1440px, matching the design
  reference's artboard) compared against the `1a Home` mockup section for
  layout fidelity.

`summarizeTimeline` and `getDueCardBreakdown`'s "new" logic are small, pure-ish
candidates worth a unit test once `/tests` sets up a runner - not a blocker
here.

## Notes for the AI

- Keep all new aggregation logic in `cards.ts`/`stats.ts`, not in
  `home.get.ts` - matches the existing `getOverallStats`/`listArtistStats`
  split (server routes stay thin, utils hold the Drizzle queries).
- `getWeakestDecks` pools artist and anime groupings into one ranked list (the
  mockup itself mixes an anime title and two artist names in one "Weakest
  decks" list) - don't build two separate top-3 lists and merge client-side,
  compute one ranked list server-side.
- Reuse `/stats`' exact `passRateTier`/`formatPassRate`/`formatStreak` logic
  (same thresholds: pass >= 70%, warning 40-69%, fail < 40%) for Home's
  progress bars - copy the pattern into this page's own scoped script, no
  shared composable exists for it yet (same "every redesigned page owns its
  styles/helpers" precedent 50e followed for `tab-seg`).
- `getDueCardBreakdown`'s scope should be `{ type: "all" }` for this page -
  Home has no per-deck view, unlike `/study`'s scoped sessions.
- No inline styles (coding-standards.md) - translate the mockup's inline
  `style=` values to a scoped `<style>` block using `var(--token)`, same as
  every other redesigned page.
- `default.vue`'s `.app-topbar` removal is a one-page blast radius (only Home
  ever set `showGlobalSearch`) - safe to delete outright, not deprecate.
