# Fix: Narrow global search to Cards + AniList add-a-show

**Type:** Fix
**Status:** verified

## The problem

Feature 26 added an AniList "Add a show" fallback to the nav search dropdown,
gated on the local `anime` result group being empty. In real use this surfaces
a UX problem in the existing (pre-26) search groups: searching "When They Cry"
matches the local `Anime` group and clicking it navigates to
`/decks?type=anime&id=...` - it opens a deck page, not a card. The user doesn't
want deck navigation from global search at all; they want the search bar to be
about finding or adding a card for a show. The `Artists` and manual `Decks`
groups have the same "click result -> jump to a deck page" behavior and the
same problem.

Two smaller pieces of feedback on top of that:

- Pressing Enter in the search box does nothing today (no submit handler)
  instead of jumping to the obvious next action - searching AniList to add
  the show.
- The "Add a show" row added in feature 26 only reacts to its small inner
  "Add" button, not a click anywhere on the row - inconsistent with every
  other result type, which is a single full-width clickable button.

## The fix

- **Server:** `GET /api/search` (`server/api/search.get.ts`) stops calling
  `searchArtists`/`searchAnime`/`searchManualDecks` and returns only `cards`.
  Since this endpoint is `NavBar.vue`'s only caller and those three functions
  (`server/utils/decks.ts`) have no other callers, delete the now-dead
  functions and narrow the endpoint's response/type to `{ cards }` rather than
  leaving unused server code and an unused wider contract behind.
- **Client (`NavBar.vue`):**
  - Drop the `Artists`/`Anime`/`Decks` groups, their result rendering, and
    `selectArtist`/`selectAnime`/`selectDeck` (all now dead - their only job
    was navigating to `/decks`).
  - The AniList fallback's trigger condition moves from `results.anime.length
    === 0` to `results.cards.length === 0` - it's the only local signal left,
    and the intent (offer to add when nothing local already covers the query)
    is unchanged.
  - The "Add a show" row becomes a single `<button>` spanning the whole row
    (matching the `Cards` group's own button pattern), so clicking anywhere on
    it calls `addShow`, not just a small inner button.
  - Add an Enter-key handler on the search `<input>`: if the trimmed query is
    2+ characters, call `resetSearch()` then `navigateTo(`/cards/new?q=${q}`)`
    - the same "hand off to `/cards/new`" pattern `addShow` already uses, just
      keyed by the raw query text instead of a chosen AniList id.
  - Placeholder text changes from `"Search..."` to `"Search Anime"`.
- **`/cards/new`:** on mount, alongside the existing `aniListId` handling
  (feature 26), also read `route.query.q`. If it's a non-empty string, set
  `searchQuery.value` to it and call the page's existing `search()` (the exact
  function the manual "Search" button already calls) - no new search logic,
  just a second trigger for the one that's already there. `aniListId` and `q`
  are mutually exclusive in practice (only one will ever be present from a nav
  hand-off); if somehow both are present, `aniListId` wins since it's the more
  specific target.

Must not break: card search results (`Cards` group) still work and still hand
off to the card Preview modal exactly as before; the feature 26 AniList
fallback and its stale-response generation guard both keep working under the
new trigger condition; `/cards/new`'s existing manual search box and
`aniListId` deep link keep working unchanged.

## Build steps

- [x] **Step 1 - Server: narrow `/api/search` to cards only** - Remove
  `searchArtists`, `searchAnime`, `searchManualDecks` from
  `server/utils/decks.ts`; update `server/api/search.get.ts` to return only
  `{ cards: searchCards(query) }`.
  *Done when:* `GET /api/search?q=<query>` returns only a `cards` key; `bun
  run build` is clean with no leftover references to the removed functions.

- [x] **Step 2 - Client: Cards-only dropdown, whole-row Add, Enter-to-add,
  new placeholder** - In `NavBar.vue`: remove the `Artists`/`Anime`/`Decks`
  groups, their template blocks, and `selectArtist`/`selectAnime`/`selectDeck`;
  update `SearchResults`/`emptyResults`/`hasResults` to cards-only; move the
  AniList-fallback gate to `results.cards.length === 0`; convert the "Add a
  show" row to one full-width `<button>` (drop the separate inner `.add-show-btn`
  in favor of the shared `.search-result` button styling, matching the `Cards`
  group); add an `@keydown.enter` handler that hands off to
  `/cards/new?q=<query>` for a 2+ character query; change the input
  placeholder to `"Search Anime"`.
  *Done when:* searching "When They Cry" (or any anime already in the
  library) shows only its `Cards` matches (if any) and no deck-navigating
  result; clicking anywhere on an "Add a show" row navigates like today's Add
  button did; pressing Enter with a 2+ character query navigates to
  `/cards/new?q=<query>` and closes the dropdown; the input shows "Search
  Anime" as its placeholder.

- [x] **Step 3 - `/cards/new` handles a `?q=` deep link** - Add a second
  `onMounted` check (alongside the existing `aniListId` one) for
  `route.query.q`: if present and non-empty, set `searchQuery.value` and call
  `search()`.
  *Done when:* visiting `/cards/new?q=Bocchi` pre-fills the search box with
  "Bocchi" and shows AniList results automatically, with no manual "Search"
  click needed; `/cards/new?aniListId=...` still behaves as it did before this
  fix; `/cards/new` with neither param is unchanged.

## Verify

- `bun run build` clean after each step.
- Manual: search an anime already in the library -> only `Cards` results (or
  nothing) show, never a deck-navigating result. Search an anime not in the
  library -> "Add a show" row appears, clicking anywhere on it (not just a
  small button) lands on `/cards/new?aniListId=...` with themes loading. Press
  Enter with a fresh query -> lands on `/cards/new?q=...` with AniList results
  already shown. Confirm the placeholder reads "Search Anime".
- No test runner configured in `AGENTS.md`; this is UI/integration behavior,
  so it rides on manual/browser verification and build evidence, same as
  feature 26.

## Verification evidence

- `bun run build` - clean after every step and at the final safety pass.
- Endpoint/route evidence via curl (dev server): `/api/search?q=<query>`
  returns `{ cards: [] }` (new shape); `/cards/new` with no param, `?q=Bocchi`,
  `?aniListId=130003`, and both together all return `200`.
- Gap: Playwright is not installed in this project, so the interactive
  dropdown (typing, Enter key, clicking the "Add a show" row) was not clicked
  through in a live browser - verified by code read-through plus the
  endpoint/build evidence above.

## Findings

None raised against this fix.
