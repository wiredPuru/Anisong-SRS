# Feature: Decks

**From build-plan:** feature 50d
**Status:** verified

## Goal

Relayout `/decks` to the Akiba Neon `1a Decks` artboard: a 6-column poster
grid (cover art doing the work) filling the window beside the rail, replacing
today's centered 640px vertical list and pill toggle row. Applies to all three
tabs (By title / By artist / Created) and to a selected deck's detail view,
which the artboard doesn't mock but which still needs to move off the old
960px-era styling onto 50a/50b/50c's shell and tokens.

## Design reference

`blueprint/reference/akiba-neon-canvas.html`, artboard
`data-screen-label="1a Decks"`. Covers the top-level grid only - no artboard
exists for a selected deck's detail view (see Step 4).

## In scope

- **Header strip**: `Decks` in the display face, a segmented `By title / By
  artist / Created` control replacing the current three pill buttons, the
  existing search input, and a `Study all` button - matching 50c's
  `.cards-header` shell (`--surface-sunken`, bottom border, `--font-display`
  title).
- **Dropping the standalone "Review stats" link.** Redundant now that 50a's
  rail nav has its own Stats icon - the same reasoning that removed `/cards`'
  leftover "Add card" button in feature 49's follow-on. `Study all` stays
  (the rail has no one-click "study everything" shortcut).
- **Poster grid**: 6-column CSS grid, `2/3` aspect-ratio cover tiles,
  `--radius-sm`, label + `N cards` beneath each tile. Anime tiles use
  `animeCoverImageUrl`; artist and manual-deck tiles have no cover image and
  render the same grey placeholder tile the artboard shows for those rows.
- **Per-tile pass rate** (`N cards · NN%`): real, already-aggregated data -
  the same `passCount`/`totalReviews` grouping `listArtistStats`/
  `listAnimeStats` already do for `/stats`, added to all three deck-listing
  queries (including manual decks, via `deckCard`) as a merged second query,
  not a join that would fan out `cardCount`.
- **Per-tile "N due" badge** - artist and anime tiles only, via one new
  grouped query sharing `dueCardCondition`'s due/scope/new-card-limit logic
  (feature 40's helper), not N calls to `getDueCardCount` per tile. Not shown
  on Created tiles - manual decks have no `StudyScope` to be due against,
  same reason `/decks` already hides "Study this deck" for them.
- **"+ New deck" grid tile** (Created tab only) - a dashed-border tile as the
  grid's last cell, replacing today's always-visible text input above the
  list. Click reveals an inline name input + confirm in the same tile.
- **Infinite scroll** adapted to the grid (sentinel spans the full grid row).
- **Detail view retheme** (Step 4) - the selected-deck screen (card list, add
  cards, export block, rename/delete) restyled onto 50a's tokens and shell
  conventions. Structure stays a themed list, not a new layout - no artboard
  exists for it, so this is retheme, not redesign.

## Out of scope

- **A new poster-grid layout for the detail view.** No artboard covers it;
  see Step 4's scope note above. Inventing a grid/inspector split here would
  be designing blind, exactly what `ai-interaction.md` warns against for
  visual features.
- **Cover art for artist or manual decks.** Neither has a single image to
  show (an artist can span many anime; a manual deck is arbitrary). The grey
  placeholder tile is deliberate, matching the artboard's own uncovered rows.
- **Changing `Study this deck`'s scope rules.** Still hidden for manual decks,
  unchanged from today.
- **The narrow-window pass** - 50h.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - header strip + segmented tabs.** Replace `<h1>`/hint/link
  block with a `.decks-header` strip (title, segmented `By title/By
  artist/Created` control, search input, `Study all` button). Drop the
  "Review stats" link. Page root becomes `flex:1; min-height:0; display:flex;
  flex-direction:column` like `/cards` and `/study`.
  *Done when:* `/decks` fills the window beside the rail; switching tabs via
  the segmented control still clears search and reloads that tab; the search
  input still filters with its existing debounce; `Study all` still links to
  `/study?type=all`; `bun run build` clean.

- [x] **Step 2 - poster grid.** Replace `.deck-list`/`.deck-row` with the
  artboard's 6-column grid: cover tile (or placeholder) + label + `N cards`
  underneath. Clicking a tile still navigates to that deck's detail view via
  the existing `?type=&id=` query. The Created tab's "+ New deck" tile
  replaces the standalone create form; clicking it reveals an inline
  name input + confirm/cancel in place, wired to the existing `createDeck()`.
  *Done when:* every deck renders one grid tile; artist/manual tiles show the
  placeholder, anime tiles show their cover; infinite scroll still loads more
  on scroll (sentinel spans the grid); creating a deck from the new tile still
  calls `POST /api/decks` and the new deck appears; rename/delete on a
  Created-tab tile are still reachable (inline, same as today, restyled); the
  existing loading/error/"no decks match" empty states still render, restyled
  onto the new shell.

- [x] **Step 3 - due count + pass rate per tile.** Add `passRate: number |
  null` to `ArtistDeck`, `AnimeDeck`, and `ManualDeck`. Reuse the same
  grouped shape `listArtistStats`/`listAnimeStats` already compute in
  `server/utils/stats.ts` (`reviewLog` left-joined, grouped, `passRate` via
  `deriveCounts`), but scoped to just the current page's ids
  (`WHERE id IN (...)`) rather than calling those unbounded functions - merge
  the result into the paginated items by id, not joined directly into the
  `cardCount` query, to avoid fan-out. Manual decks need a new query in the
  same shape (`deckCard` -> `card` -> `reviewLog`, grouped by `deck.id`),
  since no existing function covers them. Add `dueCount: number` to
  `ArtistDeck` and
  `AnimeDeck` only, via one new grouped query reusing `dueCardCondition`
  (exported from `server/utils/cards.ts` for this) grouped by `artist.id`/
  `anime.id`. Render `N cards · NN%` under each tile's label and the due
  badge on the cover when `dueCount > 0`.
  *Done when:* a deck with reviews shows a real pass rate, one with none
  shows no percentage (not `NaN%`); a deck with due cards shows the badge
  with the correct count and one with none shows no badge; Created tiles
  never show a due badge; `bun run build` clean.

- [x] **Step 4 - detail view retheme.** Restyle the selected-deck screen (back
  control, header with cover/title/"Study this deck", the add-cards block for
  Created decks, the card list, the export block, rename/delete) onto 50a's
  tokens (`--surface-sunken`, `--border`, `--radius-sm`, `--font-display`
  headings) and 50c's row conventions, matching the app shell instead of the
  old 640px centered layout. Structure unchanged - no new grid/inspector
  split, since no artboard covers this screen.
  *Done when:* the detail view fills the window beside the rail; every
  existing action (Preview, remove, download, export, add-existing/add-new
  card, rename/delete for Created) still works; zero hex literals remain in
  the page; `bun run build` clean and all six routes 200.

- [x] **Step 5 - fix: poster grid needs at least 2 rows visible.** User-reported
  after review: on a wide-but-not-tall window, the fixed `repeat(6, 1fr)`
  grid stretches each `2:3` cover tile to fill the available width, making
  every row tall enough that only about one row fits before the body has to
  scroll. Switch to `grid-template-columns: repeat(auto-fill, minmax(150px,
  1fr))` so tile width is bounded - the grid adds more columns on wide
  screens instead of stretching existing ones, keeping row height in check.
  *Done when:* at a representative wide desktop viewport, at least 2 full
  rows of tiles are visible without scrolling; narrower viewports still show
  a sensible multi-column grid; `bun run build` clean.

## Files / areas

- `nuxt-app/app/pages/decks/index.vue` - template and styles (all steps).
- `nuxt-app/server/utils/decks.ts` - `passRate`/`dueCount` queries (Step 3).
- `nuxt-app/server/utils/cards.ts` - export `dueCardCondition` for reuse
  (Step 3).
- `nuxt-app/server/api/decks.get.ts` - no signature change; the extra fields
  ride on the existing `ArtistDeck`/`AnimeDeck`/`ManualDeck` shapes.

## Data / contracts

Additive only - no schema change, no route signature change.

```ts
interface ArtistDeck { id: number; name: string; cardCount: number; passRate: number | null; dueCount: number; }
interface AnimeDeck { id: number; titleEnglish: string; titleRomaji: string; coverImageUrl: string | null; cardCount: number; passRate: number | null; dueCount: number; }
interface ManualDeck { id: number; name: string; createdAt: Date; cardCount: number; passRate: number | null; }
```

`passRate` follows `deriveCounts()`'s existing rule in `server/utils/stats.ts`
(`null` when `totalReviews` is 0). `dueCount` reuses feature 40's
`dueCardCondition(scope)`, grouped rather than called per-scope, so the
shared daily-new-card-limit subquery runs once per request, not once per tile.

Measured off the artboard: grid `repeat(6, 1fr)`, `20px` gap, cover
`aspect-ratio: 2/3`, `--radius-sm`, due badge `--accent` fill top-right,
label `14px/700`, meta line `12px`, `--faint`. Header segmented control:
`1px solid var(--border)`, `--radius-sm`, active segment
`--surface-raised` background + `--text`.

## Testing

No test runner configured; this rides on build and browser evidence.

- Check Step 3's `passRate`/`dueCount` queries directly against `/api/decks`
  (curl or browser network tab) for at least one artist and one anime deck
  with real review history, and one with none.
- Check the Created tab's new-deck tile end to end (create, then it appears
  in the grid) and rename/delete still work inline.
- Check the detail view's five existing actions after Step 4 (remove, edit
  preview, download, export, add-existing/add-new) - the most likely
  casualties of a retheme touching a 700+ line template.
- `bun run build` and all six routes 200 at the end.

## Not verified in a browser

`/decks` loads its list and detail data client-side, so no server-side check
reaches the grid, the tabs, or the detail view. Confirm before building on
this: tab switching, tile navigation, the new-deck tile, and every detail-view
action, in a real browser - the same caveat 50c's spec carried for `/cards`.

## Notes for the AI

- **The artboard only mocks the top-level grid.** Step 4's detail view has no
  visual target - retheme it onto existing tokens/shell conventions, don't
  invent new layout structure for it.
- **Verify a field exists before rendering it** - same discipline 50b and 50c
  used for the artboard's fictional fields. `passRate`/`dueCount` here are
  real (grouped from `ReviewLog`/`dueCardCondition`), not fiction, but stay
  alert for anything else the artboard implies that the data doesn't back.
- Reuse 50c's `.cards-header`/`.cards`/shell pattern rather than inventing a
  new header shape - `.decks-header`, `.decks` should mirror it directly.
- `decks/index.vue` is ~890 lines with a lot of live state (tabs, search,
  infinite scroll x2, create/rename/delete, export, add-cards, downloads).
  Steps 1-2 touch the list view's markup/styles only; Step 4 touches the
  detail view's markup/styles only - keep each step's diff to its own half of
  the file where possible.
- Keep the conventions: scoped `<style>`, `var(--token)`, no hard-coded
  colors, no em dashes.

## Findings

_No resolved findings from this feature. Three unrelated pre-existing findings
(F-04, F-05, F-07) remain `fixed` in the live ledger, awaiting `/audit`
re-review to close - not archived here since they weren't raised against or
resolved by this feature._
