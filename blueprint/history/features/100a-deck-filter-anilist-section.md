# Feature: AniList section in the deck filter window (100a)

**From build-plan:** feature 100a (first of two sub-features of 100, "AniList matches in the deck filter window")
**Status:** verified

## Goal

In "Add cards from filters" / "New deck from filters" (`DeckFilterCardsModal.vue`), a
**Not in your library yet** section lists the AniList shows that match the current filters
and that you have no cards for. It is read-only: no ticks, no import (100b). This answers
"I filter by a genre in a deck and want to see the matching shows I don't have yet".

## In scope

- A shared composable, `app/composables/useAniListBrowse.ts`, that owns the fetch state
  `CardBrowseModal.vue` keeps today: results, page, `hasNextPage`, loading, loading-more,
  error, `loadFirst`, `loadMore`, and the stale-answer guard (`createLatestRequest`).
  `CardBrowseModal.vue` moves onto it with no behaviour change.
- In the deck modal: a **Search AniList** button under the library results. Pressing it
  runs `POST /api/lookup/anilist-browse` with `toBrowseFilters(draft)` (feature 96a's route,
  unchanged). After the first press the list refreshes, debounced, whenever the filters
  change; it is cleared when the modal closes.
- The list shows only shows with `inLibrary === false`: cover, title, year, format, score.
  A header line counts them ("N shows on AniList you don't have yet").
- Auto-continue: because most popular matches are often already owned, after each page the
  section keeps loading further pages until at least 20 unowned shows are listed, AniList
  has no more pages, or 10 pages have been scanned in this search; after that, further
  pages load on scroll as in Browse. A pure helper decides this and has tests.
- A one-line note that OP/ED and the Anime list do not apply to AniList results, shown
  only when one of them is set.
- Works in both the add-to-existing-deck and "New deck from filters" (create) modes.

## Out of scope

- Ticks, selection, the 300 cap, the import, and any change to Add (100b).
- AniList's own full genre and tag lists in the filter form: it keeps the library's lists.
- Any server change: 96a's route already returns `inLibrary` and `cardCount`.

## Build loop

Build one step at a time. Plan, implement just that step, show the diff, approve, then
optionally checkpoint. `/complete` makes the real commit.

## Build steps

- [x] **Step 1 - Shared fetch composable** - extract the AniList browse fetch state from
  `CardBrowseModal.vue` into `useAniListBrowse`, and switch the modal to it. The modals keep
  their own debounce watchers, observers, and selection. *Done when:* in the browser,
  `/cards` > Browse by filters in Add mode behaves as before (50 shows load, a filter
  change reloads from page 1, scrolling to the bottom loads more, switching to Search my
  library and back reloads), `bun run build` and `bun run test` pass.
- [x] **Step 2 - Auto-continue rule** - a pure `needsMorePages` helper in
  `app/utils/` (inputs: unowned count so far, `hasNextPage`, pages scanned, with the 20 and
  10 limits as named constants) with Vitest cases: enough shows found, no next page, page
  budget spent, and still short. *Done when:* the tests cover each stop reason and pass.
- [x] **Step 3 - The section in the deck modal** - the Search AniList button, the unowned
  list, the count line, the auto-continue loop, the OP/ED and list note, loading and error
  states (an AniList failure shows an inline message and leaves the library part usable),
  and clearing on close. *Done when:* in the browser, in a manual deck's "From filters"
  window with Genres > Ecchi, the library list is unchanged, pressing Search AniList lists
  shows not in the library (none of them with an "In library" state), the count line matches
  the rows, changing a filter refreshes it, a deck-create modal does the same, the Add
  button and its count still reflect only the library part, and no console errors appear.

## Files / areas

- `nuxt-app/app/composables/useAniListBrowse.ts` (new)
- `nuxt-app/app/utils/` (new pure helper + test)
- `nuxt-app/app/components/card/CardBrowseModal.vue` (moves onto the composable)
- `nuxt-app/app/components/deck/DeckFilterCardsModal.vue`

## Data / contracts

- `BrowseAnime` (`app/utils/browseSelection.ts`) and `toBrowseFilters` are reused as is.
- `useAniListBrowse` is load-bearing: 100b builds selection and import on top of it.
- No route, schema, or stored-shape change.

## Testing

- Vitest for `needsMorePages` (Step 2). The composable and modal ride on browser evidence
  (`playwright-cli`, as 99b did) and `bun run build`. Do not test AniList itself; the live
  route is already proved by 96a.

## Notes for the AI

- Behaviour-preserving refactor in Step 1: change structure only, and check the
  `CardBrowseModal` flows by hand before and after.
- AniList is searched only on request, so the deck modal never calls it on open or on a
  filter change before the first press.
- Reuse the existing modal conventions: scoped styles with `var(--token)`, no inline
  styles, and the `.anime-row` look already in this modal and `CardBrowseModal`.
- Be polite to AniList: the page budget and debounce exist to bound requests, so do not
  raise them without a reason.
- The "In library" rows are filtered out client side from 96a's `inLibrary` flag, so a show
  the user already has can never appear in this section.

## Outcome

Built as specced. `useAniListBrowse` (new composable) now owns the AniList browse fetch state and stale-answer guard; `CardBrowseModal.vue` moved onto it (49 lines fewer, same behaviour), and `browseAnimeMeta` moved into `browseSelection.ts`. `needsMorePages` (`browseAutoContinue.ts`, 4 tests) stops at 20 unowned shows, no next page, or 10 pages. `DeckFilterCardsModal.vue` gained the "Not in your library yet" section: a Search AniList button (plus a header link), a read-only list of unowned shows, auto-continue loading, an OP/ED and Anime list note, and a reset on close. Evidence: `bun run test` 1765 pass and `bun run build` passes; in a real browser on the owner's library, Browse in Add mode loaded 50, scrolled to 100, reset to 50 on a filter change and on a mode flip; in a deck's "From filters" window with Ecchi the library list stayed at 106 shows and 358 cards, nothing called AniList before the button, Search AniList listed 49 unowned shows, adding Comedy refreshed to 81 library and 60 AniList shows, Inserts showed the note, reopening reset it, and the create form showed the same section; no console errors. AniList returned 503 briefly during testing (its rate limit), then recovered. Not exercised: the AniList error message in this section, and a narrow window.

