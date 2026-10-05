# Feature: Mode switch + apply to the list (99b)

**From build-plan:** feature 99b (second and last sub-feature of 99, "Search your library from Browse by filters"; 99a is built)
**Status:** verified

## Goal

"Browse by filters" on `/cards` gets a second mode, **Search my library**. It uses the
shared filter form plus a **Downloaded** toggle, shows how many library cards match,
and "Show N cards" narrows the `/cards` list to them, with a clearable "Library filter"
chip. This is how you get, for example, every insert song you have downloaded, with the
inspector, Play, and bulk actions working on the result. Searching adds and changes nothing.

## In scope

- `CardBrowseModal.vue`: a Add from AniList / Search my library switch (default Add, so
  today's behaviour is the first thing seen). Library mode shows
  `StudyFilterForm` (library options, OP/ED including Inserts), a Downloaded checkbox, a
  live "N cards match" count (debounced, stale answers dropped), and "Show N cards".
  Add mode is unchanged; its AniList fetching only runs while it is the active mode.
- `StudyFilterForm.vue`: a prop to hide the Anime list section in this mode (its ids can
  run to thousands and do not fit a GET URL; decided at intake).
- `/cards` page: holds the applied library filter (session only, not in the URL). The
  list, "load more", and "Delete all N matching" all send it through one shared query
  builder (`filters` and `downloaded`, which 99a's routes already accept), and it
  combines with the text search and the No AnimeThemes match / Suspended toggles.
- A "Library filter" chip with a short description ("Insert songs, downloaded") and Clear.
  Clear restores the unfiltered list. Reopening the modal in library mode starts from the
  applied filter.
- A pure helper module with tests (see Step 1).

## Out of scope

- Remembering the filter across reloads or putting it in the URL.
- The Anime list filter in library mode.
- A text box inside the modal: the page's own search box already combines with it.
- Server changes: 99a delivered them.

## Build loop

Build one step at a time. Plan, implement just that step, show the diff, approve, then
optionally checkpoint. `/complete` makes the real commit.

## Build steps

- [x] **Step 1 - Pure helpers** - `app/utils/libraryFilter.ts`: a `LibraryFilter`
  (`{ filters: StudyFilters; downloadedOnly: boolean }`) and `EMPTY_LIBRARY_FILTER`;
  `libraryFilterActive` (any filter or Downloaded on); `libraryQuery` (the `filters` and
  `downloaded` query params, reusing `filtersQueryValue`, undefined when off);
  `describeLibraryFilter` (the chip and confirm text, e.g. "Insert songs, downloaded",
  falling back to "N filters" for mixed ones). Vitest next to it. *Done when:* tests
  cover empty, Downloaded only, Insert only, both, and a multi-filter description, and
  `bun run test` passes.
- [x] **Step 2 - Library mode in the modal** - the mode switch, `StudyFilterForm` with the
  list section hidden, the Downloaded checkbox, and the live match count via
  `GET /api/cards?page=1` (reading `total`). Add mode keeps working and stops fetching
  AniList while hidden. No "Show" button yet. *Done when:* in the browser, switching to
  Search my library, ticking Inserts and Downloaded shows the count (matches
  `curl`'s total for the same filters, 33 on the owner's library when this was
  specced), switching back shows the AniList results again, and invalid filters show the
  existing inline error instead of a count.
- [x] **Step 3 - Apply to the list** - "Show N cards" (disabled with no filter set or
  while the count loads) emits the `LibraryFilter` and closes. The page stores it, builds
  one query for `loadFirstPage`, `loadMore`, and `deleteAllMatching`, shows the chip with
  Clear, and counts the filter as active for the "Delete all N matching" bar and its
  confirm text. *Done when:* Show narrows `/cards` to exactly the matching cards (total
  equals the modal's count), Clear restores the full list, the filter combines with the
  search box and Suspended toggle, "Delete all N matching" appears and its confirm names
  the filter (cancel it, do not delete), and the modal reopens with the filter filled in.

## Files / areas

- `nuxt-app/app/utils/libraryFilter.ts` (+ test, new)
- `nuxt-app/app/components/card/CardBrowseModal.vue`
- `nuxt-app/app/components/study/StudyFilterForm.vue` (one prop)
- `nuxt-app/app/pages/cards/index.vue`

## Data / contracts

- `LibraryFilter` is load-bearing within this feature: the modal emits it, the page stores
  it, the helpers read it. It carries a normal `StudyFilters` whose `listAniListIds` and
  `listSource` are always null here.
- Query params to `/api/cards` and `/api/cards/ids`: `filters` (JSON via
  `filtersQueryValue`) and `downloaded=1`. No route, schema, or stored-shape change.

## Testing

- Vitest for the helpers (Step 1). Components and the page ride on browser evidence:
  `bun run measure` (or Playwright if present) screenshots of the modal in both modes and
  the chip, plus `curl` totals to compare counts. `bun run test` and `bun run build` pass.

## Notes for the AI

- Follow the existing modal conventions: scoped styles with `var(--token)`, no inline
  styles, `role="dialog"`, Escape and backdrop close, the segmented-control look the
  Decks and Stats tabs use.
- Reuse `createLatestRequest` for the debounced count so a slow answer cannot overwrite a
  fresher one, as the AniList fetch already does.
- Keep the page's three duplicated `{ q, missingAnimeThemes, suspended }` query objects
  from growing a fourth copy: introduce the shared builder in Step 3 rather than pasting
  `filters` and `downloaded` into each.
- The "Delete all N matching" safety stays: the bar still shows only for an active filter,
  and `/api/cards/ids` still refuses an unfiltered call.
- Do not clear the page's existing `?q=`, `missingAnimeThemes`, or `suspended` state when
  a library filter is applied or cleared.

## Outcome

Built as specced. `app/utils/libraryFilter.ts` (11 tests) holds the filter type, `libraryQuery`, and the chip text. `CardBrowseModal.vue` gained the Add from AniList / Search my library switch, a Downloaded checkbox, and a debounced match count read from `GET /api/cards` (`total`); `StudyFilterForm.vue` gained a `hide-list` prop. `/cards` holds the applied filter in session state and sends it through one `matchQuery()` shared by the list, load-more, and "Delete all matching", with a clearable chip. Evidence: `bun run test` 1761 pass and `bun run build` passes; in a real browser on the owner's library (`playwright-cli`), Inserts + Downloaded showed "33 cards match", Show made the list "33 total" with the chip and a "Delete all 33 matching" bar (confirm named the filter, cancelled), reopening pre-filled the filter, Clear restored 1354, and an invalid year range showed the inline error. A first screenshot showed the mode switch clipped; fixed with `flex: none` and the Downloaded checkbox moved above the form. Not exercised: a narrow window, and the filter combined with the search box or Suspended toggle in the browser.

