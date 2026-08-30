# Feature: Decks library search + infinite scroll

**From build-plan:** feature 35b
**Status:** verified

## Goal

Replace `/decks`' top-level list numbered pagination with scroll-triggered
"load more," and add a search box that filters whichever tab is active
(Artist/Anime/Created) by artist name, anime title, or manual deck name
respectively. Second of three sibling sub-features (35a `/cards`, done; 35b
here; 35c a deck's detail card list, still deferred) applying the same two
changes to one more list surface, following 35a's proven pattern.

## In scope

- `GET /api/decks` accepts an optional `q` query param, applied per `type`:
  - `type=artist` - matches `artist.name`.
  - `type=anime` - matches `anime.titleEnglish`/`titleRomaji`/`titleNative`
    (same three-field `or(like(...))` shape `listCards`' anime match
    already uses).
  - `type=created` - matches `deck.name`.
  All case-insensitive substring matches via Drizzle `like`, blank/missing
  `q` behaving exactly as today (no filter).
- A search input on `/decks`' top-level list (all three tabs, placeholder
  text changes per tab - "Search artists...", "Search anime titles...",
  "Search deck names..."), debounced 250ms with the same generation-counter
  pattern 35a used.
- Switching tabs (Artist/Anime/Created) clears the search box and reloads
  that tab's list fresh - each tab's search is independent, not carried
  across.
- Typing a query resets that tab's list to a fresh first load under the
  query; clearing the box returns to the unfiltered list.
- The numbered `<Pager>` used for the **top-level list only** is removed and
  replaced with infinite scroll (sentinel + `IntersectionObserver`, same
  mechanism 35a built) - "Loading more..." while a next-page fetch is in
  flight.
- Two empty states per tab: today's existing no-query message ("No manual
  decks yet. Create one above." / "No decks yet. Add a card to start one.")
  vs. a new `No decks match "<query>"` when a query is active and matches
  zero.
- The existing manual-deck actions on this list - create, rename, delete -
  reload the list via the new mechanism (a fresh first load of the current
  tab/query) instead of the old `useFetch`'s `refresh()`, since that
  `useFetch` call is being removed.
- The top-level list's `?page=` URL query param is dropped, matching 35a.
  `?type=` stays (still meaningful - which tab is active, unrelated to
  pagination). `?q=` is not added, matching 35a.

## Out of scope

- **Deck-detail's own card list** (`selectedId !== null` - its own
  `useFetch`, its own `<Pager>`, `?cardPage=`) - untouched. This is 35c, a
  separate sub-feature. Its `<Pager :page="deckDetail.page" ...>` usage
  stays exactly as it is today.
- **The "Add cards" search box inside a manual deck's detail view**
  (`addCardQuery`/`runAddCardSearch`, feature 28) - a completely different
  search (finds cards to attach to a deck, hits `/api/search` and
  `/api/lookup/anilist-search`), not touched by this feature at all.
- Reflecting the search query in the URL (`?q=`) - matches 35a, a plain
  in-memory ref is enough.
- Changing what a deck row shows or does (cover thumbnail, card count,
  rename/delete buttons, click-to-select) - untouched, only how the
  top-level list is fetched and paged changes.
- `/cards/new`, `CardPreviewModal.vue`'s own `GET /api/decks?type=created`
  call (for the deck-membership checkbox panel) - both already omit `page`/
  `q`, so the new optional `q` param doesn't affect them; not touched.
- `35c` itself (deck-detail search + infinite scroll) - separate `/feature`
  run.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - server: `q` filter on `GET /api/decks`, per type**
  - In `nuxt-app/server/utils/decks.ts`: change `listArtistDecks(page: number)`,
    `listAnimeDecks(page: number)`, and `listManualDecks(page: number)` to
    accept an optional `query?: string` second param, matching
    `cards.ts`'s `listCards`/`cardSearchCondition` shape - a small
    `xSearchCondition(query?: string)` helper per function returning
    `undefined` for a blank/missing query, else the `like`/`or(like(...))`
    condition described above. Apply the condition conditionally
    (`condition ? base.where(condition) : base`) to **both** the total
    count query and the items query, before `.groupBy()`/`.orderBy()`/
    `.limit()`/`.offset()`, so `total`/`totalPages` reflect the filtered
    set. No query behaves byte-for-byte as today.
  - In `nuxt-app/server/api/decks.get.ts`: read `q` from `getQuery(event)`,
    trim it, pass it through to `list(requestedPage, trimmedQuery)` (both
    call sites - the initial call and the clamped-page retry).
  - *Done when:* `GET /api/decks?type=artist&q=<known artist substring>`
    (and the equivalent for `anime`/`created`) returns only matching decks
    with a correct `total`-derived `totalPages`; `GET /api/decks` with no
    `q` is byte-for-byte the same response shape as before, for all three
    types. `bun run build` passes.

- [x] **Step 2 - client: search box (pagination unchanged)**
  - In `nuxt-app/app/pages/decks/index.vue`, add a search `<input>` above
    the top-level `<ul class="deck-list">` (below the Artist/Anime/Created
    toggle, and below the "Created" tab's new-deck form), bound to a
    `searchQuery`/`searchInput` pair with the same 250ms debounce pattern
    35a used. Placeholder text is a computed keyed off `activeType`.
  - Add `q: searchQuery.value || undefined` to the existing
    `useFetch("/api/decks", ...)` computed query object.
  - Reset the URL's `page` back to `1` (via the existing `router.push`
    pattern `goToPage` already uses) whenever `searchQuery` changes -
    `setType()`'s tab-switch already resets `page` for free today (it calls
    `router.push({ query: { type } })` with no spread, replacing the whole
    query object rather than merging). Clear `searchInput`/`searchQuery`
    inside `setType()` when switching tabs.
  - Update the empty-state text to show `No decks match "<query>"` when
    `searchQuery` is non-blank and the list is empty, keeping today's two
    existing per-tab messages for the no-query-and-empty case.
  - *Done when:* typing in the box filters the currently active tab's list
    (via the existing numbered `<Pager>`, still page 1-N); switching tabs
    clears the box and shows that tab's unfiltered list; clearing the box
    restores the full list; the right empty-state message shows for a
    query with zero matches vs. a genuinely empty tab. `bun run build`
    passes.

- [x] **Step 3 - client: swap the top-level `<Pager>` for infinite scroll**
  - Replace the top-level list's `useFetch`/`data`/`pending`/`error`/
    `refresh`/`page`/`goToPage`/`<Pager>` mechanism with the same
    accumulating-ref + `$fetch` + `IntersectionObserver` mechanism 35a
    built for `/cards` (`initialPending`/`initialError`/`loadingMore`
    refs; a `sentinelRef` watched via `IntersectionObserver`, set up in
    `onMounted`, torn down in `onUnmounted`). Keep the existing `deckItems`
    computed mapping (`ArtistDeck`/`AnimeDeck`/`ManualDeck` -> unified
    `DeckItem[]`) unchanged, just re-source it from the new accumulating
    raw-items ref instead of `data.value.decks`.
  - `watch([activeType, searchQuery], () => loadFirstPage())` replaces the
    URL-based page-reset from Step 2 (the `?page=` query param is dropped
    entirely now, matching 35a).
  - Update `createDeck()`, `saveRenameDeck()`, and `deleteDeck()` - each
    currently calls the old `useFetch`'s `refresh()` after a successful
    mutation - to call the new `loadFirstPage()` instead (a fresh first
    load of the current tab/query; simplest correct behavior, matching how
    a search-query change already reloads to a fresh first page rather
    than trying to patch the accumulated list in place).
  - Deck-detail's own `useFetch`/`<Pager>` (the `selectedId !== null`
    branch) is untouched - this step only touches the top-level list.
  - *Done when:* loading `/decks` with more than one page's worth of decks
    in any tab shows the first page, then scrolling to the bottom loads and
    appends the next page automatically until exhausted. Searching or
    switching tabs mid-scroll resets to a fresh first load of the new
    tab/query (not "Loading more..."). Creating, renaming, or deleting a
    manual deck (Created tab) refreshes the visible list correctly. No
    duplicate or skipped decks across loaded pages. A simulated fetch
    failure on the first/query-driven load shows the existing error state;
    a failure on a scroll-triggered load doesn't wipe already-loaded decks.
    Deck-detail (clicking into a deck) is completely unaffected - its own
    `<Pager>` still works exactly as before. `bun run build` passes.

## Files / areas

- `nuxt-app/server/utils/decks.ts` - `listArtistDecks`/`listAnimeDecks`/
  `listManualDecks` gain the `query` filter.
- `nuxt-app/server/api/decks.get.ts` - reads and forwards `q`.
- `nuxt-app/app/pages/decks/index.vue` - search input, debounce, infinite
  scroll for the **top-level list only**; `createDeck`/`saveRenameDeck`/
  `deleteDeck` updated to reload via the new mechanism. Deck-detail's own
  fetch/`<Pager>`/add-card search are untouched in this file.

## Data / contracts

- `GET /api/decks` request gains an optional `q: string` query param,
  applied per `type` as described above. Response shape (`{ decks, page,
  totalPages }`) is unchanged.
- No schema changes.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command). The new
per-type server-side filters are simple `where`-clause logic (one
`like`/`or(like(...))` block per type, gated on a blank check) - a fine
backfill candidate once `/tests` sets up a runner, but not blocking this
feature per `coding-standards.md`'s testing gate. Verify via direct
`GET /api/decks?type=...&q=...` requests (Step 1, all three types) and a
manual browser pass (Steps 2-3, all three tabs plus deck-detail
regression), plus `bun run build` at every step.

## Notes for the AI

- Mirror `cards.ts`'s `cardSearchCondition`/`listCards` shape closely for
  each of the three deck-list functions, rather than inventing a new
  pattern - same file already has the established, working reference.
- Mirror `cards/index.vue`'s actual shipped implementation (not just 35a's
  archived spec prose) for the debounce, accumulating-ref, and
  `IntersectionObserver` shape - it diverged slightly from the original
  plan during 35a's own build (e.g. `initialPending`/`initialError` refs
  instead of repurposing `useFetch`'s `pending`/`error`). Read
  `nuxt-app/app/pages/cards/index.vue` directly as the reference, not just
  the archived 35a spec.
- This page has two independent list surfaces (top-level, deck-detail)
  sharing one file. Keep every deck-detail-only piece (`deckDetail`,
  `cardPage`, `goToCardPage`, the add-card search, export block) completely
  untouched - only the top-level list's fetch/pagination mechanism and the
  three manual-deck CRUD functions' post-mutation reload change.
- Watch for the same duplicate-append risk 35a's notes flagged: set
  `loadingMore = true` synchronously before the `await`, not after.
