# Feature: Cards library search + infinite scroll

**From build-plan:** feature 35a
**Status:** verified

## Goal

Replace `/cards`' numbered pagination with scroll-triggered "load more," and
add a search box that filters the list by song, artist, or anime title. This
is the first of three sibling sub-features (35a `/cards`, 35b `/decks`
top-level list, 35c a deck's detail card list) that each apply the same two
changes to one list surface; 35b and 35c are separate `/feature` runs.

## In scope

- `GET /api/cards` accepts an optional `q` query param. When present
  (trimmed, non-empty), only cards whose song title, artist name, or anime
  title (English/Romaji/Native) contains it (case-insensitive) are returned -
  same substring-match style `searchCards()`/`/api/search` already use
  elsewhere, just not capped at 5 results and combined with pagination.
- A search input on `/cards`, above the list, debounced 250ms with a
  generation counter guarding against a stale response landing after a newer
  one - the exact pattern `NavBar.vue`'s own search already uses.
- Typing a query resets the list to page 1 under that query; clearing the box
  returns to the unfiltered list.
- The numbered `<Pager>` is removed from `/cards` and replaced with infinite
  scroll: a sentinel element below the list, observed with
  `IntersectionObserver`, loads the next page and appends it to the list when
  it's due (in view, not already loading, more pages exist). A "Loading
  more..." line shows while a next-page fetch is in flight.
- Two distinct empty states: "No cards yet" (no query, zero total) vs. "No
  cards match '<query>'" (a query is active, zero results).
- The `?page=` URL query param is dropped - infinite scroll has no discrete
  page to deep-link to. `?q=` is not added either (out of scope below).

## Out of scope

- `/decks`' two list surfaces (top-level list, deck-detail card list) -
  35b/35c, separate sub-features.
- Reflecting the search query in the URL (`?q=`) for deep-linking/back-button
  support - not requested; a plain in-memory ref is enough here, matching how
  `NavBar`'s own search box already works (no URL sync either).
- Changing what a card row shows or does (Preview/Decks/Edit/Delete, download
  actions, source badges) - untouched, this feature only changes how the list
  is fetched and paged.
- `/cards/new` - it was never paginated (it's a live AniList lookup result
  list, not a stored-card browse list) and has no search box today; not
  touched here.
- Any change to `/api/search` (the nav bar's own autocomplete) - separate
  endpoint, separate 5-result cap, left as-is.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - server: `q` filter on `/api/cards`**
  - In `nuxt-app/server/utils/cards.ts`, change `listCards(page: number)` to
    `listCards(page: number, query?: string)`. When `query` is a non-empty
    trimmed string, add a `where` clause: `or(like(song.title, ...), like(artist.name, ...), like(anime.titleEnglish, ...), like(anime.titleRomaji, ...), like(anime.titleNative, ...))`
    (each wrapped `%query%`), applied to both the `count(card.id)` total query
    and the `cardQuery()` items query so `total`/`totalPages` reflect the
    filtered set. No `query` (or blank/whitespace-only) behaves exactly as
    today.
  - In `nuxt-app/server/api/cards.get.ts`, read `getQuery(event).q`, trim it,
    pass it through to `listCards(page, q)` (both call sites - the initial
    call and the clamped-page retry).
  - *Done when:* `GET /api/cards?q=chocho` (or any known artist/song/anime
    substring) returns only matching cards with a correct `total`-derived
    `totalPages`; `GET /api/cards` with no `q` is byte-for-byte the same
    response shape as before. `bun run build` passes.

- [x] **Step 2 - client: search box (pagination unchanged)**
  - In `nuxt-app/app/pages/cards/index.vue`, add a search `<input>` above
    `.card-list`, bound to a `searchQuery` ref.
  - Add the debounce + generation-counter pattern from `NavBar.vue`
    (`setTimeout(..., 250)`, a `searchGeneration` counter incremented per
    keystroke, discarding a response whose generation is stale) around a
    function that re-runs the existing `useFetch`'s underlying query (add `q`
    to the `query` object already passed to `useFetch("/api/cards", ...)`,
    keyed off `searchQuery`, and reset `page` to 1 whenever the query
    changes so `goToPage`'s existing pagination keeps working unmodified for
    this step).
  - Update the two empty-state messages (`No cards yet` /
    `No cards match "..."`) based on whether `searchQuery` is non-blank.
  - *Done when:* typing in the box filters the list (via the existing
    numbered `<Pager>`, still page 1-N); clearing it restores the full list;
    the right empty-state message shows for a query with zero matches vs. a
    genuinely empty library. `bun run build` passes.

- [x] **Step 3 - client: swap `<Pager>` for infinite scroll**
  - Replace the `page`/`goToPage`/`<Pager>` mechanism with an accumulating
    `cards` ref (`ref<CardWithDetails[]>([])`) populated by `$fetch` (not
    `useFetch` - matches this codebase's "`useFetch` for the initial load,
    `$fetch` for everything after" convention): first page loads on mount and
    on every search-query change (replacing `cards`), later pages append to
    it.
  - Keep the existing `pending`/`error` refs meaningful for that first/
    query-driven load specifically (today's `v-if="pending"` /
    `v-else-if="error"` template branches must keep working unchanged) -
    they're distinct from a new `loadingMore` ref that only covers a
    scroll-triggered next-page fetch, which renders inline ("Loading
    more...") below the already-visible list rather than replacing it.
  - Add a `nextPage`/`totalPages`/`loadingMore` trio of refs. A sentinel
    `<div ref="sentinelRef">` after the list is watched with
    `IntersectionObserver` (set up in `onMounted`, torn down in
    `onUnmounted`); when it intersects and `nextPage <= totalPages` and not
    already `loadingMore`, fetch that page and append.
  - Remove the `page` computed/`router.push` URL-sync code and the `<Pager>`
    usage; drop `router`/`route` if nothing else on the page still needs them.
  - *Done when:* loading `/cards` with more than one page's worth of cards
    (seed or use existing data) shows the first page, then scrolling to the
    bottom loads and appends the next page automatically, continuing until
    the last page (no more "Loading more..." and no further growth).
    Searching mid-scroll resets back to page 1 of the filtered set, showing
    the initial-load state (not "Loading more...") while it does. No
    duplicate or skipped cards across the loaded pages. A simulated fetch
    failure (or a genuine one) on the first/query-driven load still shows
    the existing error state; a failure on a scroll-triggered load doesn't
    wipe the already-loaded cards. `bun run build` passes.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `listCards()` gains the `query` filter.
- `nuxt-app/server/api/cards.get.ts` - reads and forwards `q`.
- `nuxt-app/app/pages/cards/index.vue` - search input, debounce, infinite
  scroll; `Pager` usage removed from this page (the component itself stays,
  still used by `/decks` until 35b/35c land).

## Data / contracts

- `GET /api/cards` request gains an optional `q: string` query param.
  Response shape (`{ cards, page, totalPages }`) is unchanged - `page` stays
  meaningful server-side (which page this response is) even though the
  client no longer exposes page numbers in its own UI.
- No schema changes.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command). The new
server-side filter is simple `where`-clause logic without much branching
(one `or(like(...))` block gated on a blank check) - a fine backfill
candidate once `/tests` sets up a runner, but not blocking this feature per
`coding-standards.md`'s testing gate. Verify via direct `GET /api/cards?q=`
requests (Step 1) and a manual browser pass (Steps 2-3), plus `bun run build`
at every step.

## Notes for the AI

- Match `NavBar.vue`'s debounce/generation-counter code shape closely rather
  than inventing a new pattern - this repo already has one established way to
  do a debounced, race-safe search-as-you-type box.
- `IntersectionObserver` is new to this codebase (grep confirms no existing
  use) - keep the implementation local to this one page rather than
  extracting a composable prematurely; 35b/35c can decide whether to extract
  one once a second and third real use exists (matches this project's
  "three similar lines is better than a premature abstraction" convention).
- Keep the per-card action buttons (Preview/Decks/Edit/Delete), download
  section, and edit-form markup exactly as they are - only the data-fetching
  and list-growth mechanism changes in this feature.
- Watch for a duplicate-append bug: if the `IntersectionObserver` callback
  can fire again before `loadingMore` is set, the same "next page" could be
  requested twice. Set `loadingMore = true` synchronously before the `await`,
  not after.
