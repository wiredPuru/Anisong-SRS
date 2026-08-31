# Feature: Deck detail search + infinite scroll

**From build-plan:** feature 35c
**Status:** verified (mobile search-box fix confirmed working on-device)

## Goal

Add a search box that filters the card list inside a selected deck's detail
view (Artist/Anime/Created), and replace that list's numbered `<Pager>` with
scroll-triggered "load more." Third and last of feature 35's three sibling
sub-features - 35a (`/cards`) and 35b (`/decks`' top-level list) are both
done; this applies the same two changes to the one remaining paginated list
surface, following their proven pattern.

## In scope

- `GET /api/decks/cards` accepts an optional `q` query param, applied the
  same way across all three deck types (`artist`/`anime`/`created`): matches
  song title, artist name, or anime title (EN/Romaji/Native) - the exact
  three-field shape `cards.ts`'s existing `cardSearchCondition` already
  builds for `/api/cards`. Case-insensitive substring match via Drizzle
  `like`; blank/missing `q` behaves exactly as today (no filter).
- A search input inside the deck-detail view, above the card list, filtering
  that deck's own attached cards (not a site-wide card search - the
  existing "Add cards" box, feature 28/33, is separate and untouched).
  Debounced 250ms, same generation-safe pattern as 35a/35b.
- Typing a query resets the card list to a fresh first load under that
  query; clearing the box returns to the full unfiltered list. Selecting a
  different deck (or leaving and re-entering detail view) clears the box.
- The numbered `<Pager>` on this list is removed and replaced with infinite
  scroll (sentinel + `IntersectionObserver`, same mechanism 35a/35b built) -
  "Loading more..." while a next-page fetch is in flight.
- A new `No cards match "<query>"` empty state alongside the existing
  no-query "No cards in this deck." message.
- The card-list mutations already on this view - remove card (manual decks),
  edit via Preview, download media - update the loaded list in place instead
  of refetching, since a full refetch would discard already-scrolled pages.
  Adding a card (existing-card search or new-anime-card flow, "Created" decks
  only) reloads the list fresh from the first page instead, matching how
  35b's create/rename/delete already reload fresh rather than trying to
  patch the accumulated list (a newly attached card's position in the
  creation-date sort isn't predictable client-side).
- The `?cardPage=` URL query param is dropped, matching how 35a/35b dropped
  `?page=`.
- `Pager.vue` is deleted once this ships: after this feature, the
  deck-detail list was its last remaining caller (verified - `/cards` and
  `/decks`' top-level list already dropped it in 35a/35b), so it becomes
  dead code.

## Out of scope

- `/cards` and `/decks`' top-level list (35a/35b) - already built, untouched.
- The "Add cards" search box inside a manual deck's detail view
  (`addCardQuery`/`runAddCardSearch`, feature 28/33) - a different search
  (finds cards anywhere to attach to this deck, hits `/api/search` and
  `/api/lookup/anilist-search`), not touched by this feature.
- `PAGE_SIZE` itself - stays whatever `/api/cards`/`/api/decks` already use
  (shared constant, unchanged here).
- Reflecting the search query in the URL (`?q=`) - matches 35a/35b, a plain
  in-memory ref is enough.
- Changing what a card row shows or does (cover thumbnail, badges, download
  buttons, Preview/Remove) - untouched, only how the list is fetched and
  paged changes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - server: `q` filter on `GET /api/decks/cards`, all three types**
  - Export `cardSearchCondition` from `nuxt-app/server/utils/cards.ts` (it's
    already exactly the right shape - song title / artist name / anime
    title EN+Romaji+Native).
  - Add an optional `query?: string` second param to `listCardsByArtist`,
    `listCardsByAnime`, and `listCardsByManualDeck`, combining the existing
    scope condition (`eq(artist.id, artistId)` etc.) with
    `cardSearchCondition(query)` via `and(...)` when a query is present -
    applied to **both** the total-count query and the items query, so
    `total`/`totalPages` reflect the filtered set.
  - In `nuxt-app/server/api/decks/cards.get.ts`: read `q` from
    `getQuery(event)`, trim it, pass it through to every `list*` call site
    (including each type's clamped-page retry).
  - *Done when:* `GET /api/decks/cards?type=artist&id=<id>&q=<term>` (and
    the `anime`/`created` equivalents) returns only matching cards with a
    correct `total`-derived `totalPages`; the same request with no `q` is
    byte-for-byte the same response shape as before, for all three types.
    `bun run build` passes.

- [x] **Step 1.5 - fix pre-existing bug blocking verification: `deckItems`'s
  `data.value.decks`** - unrelated to this feature's own scope, but
  discovered while manually verifying Step 2 and blocks testing 2 of the 3
  deck types this feature must cover. `nuxt-app/app/pages/decks/index.vue`'s
  `deckItems` computed references an undefined module-scope `data` ref in
  its `"created"` and `"anime"` branches (leftover from feature 35b's
  infinite-scroll rewrite, which should have used `rawDecks.value` like the
  `"artist"` branch does). Throws a `ReferenceError` server-side (500) on
  both tabs today. Fix: change both `data.value.decks` occurrences to
  `rawDecks.value`, matching the `"artist"` branch. *Done when:* `/decks`'s
  By Title and Created tabs load and render without error; Artist tab
  unaffected. `bun run build` passes.

- [x] **Step 2 - client: search box (pagination unchanged)**
  - In `nuxt-app/app/pages/decks/index.vue`'s deck-detail section, add a
    search `<input>` above `<ul class="deck-card-list">`, bound to a
    `cardSearchQuery`/`cardSearchInput` pair with the same 250ms debounce
    pattern as 35a/35b (distinct refs from the top-level list's
    `searchQuery`/`searchInput`, and from `addCardQuery` - three independent
    search boxes on this one file).
  - Add `q: cardSearchQuery.value || undefined` to the existing
    `useFetch("/api/decks/cards", ...)` computed query object.
  - Reset `cardPage` back to `1` (via the existing `goToCardPage`/router
    pattern) whenever `cardSearchQuery` changes. Clear
    `cardSearchInput`/`cardSearchQuery` in `selectDeck()` and `backToDecks()`
    so switching decks starts unfiltered.
  - Add the `No cards match "<query>"` empty state alongside the existing
    "No cards in this deck." message (query-active vs. genuinely empty).
  - *Done when:* typing in the box filters the open deck's card list (via
    the existing numbered `<Pager>`, still page 1-N); switching decks or
    leaving detail view clears the box; clearing the box restores the full
    list; the right empty-state message shows for a query with zero matches
    vs. a genuinely empty deck. `bun run build` passes.

- [x] **Step 3 - client: swap the deck-detail `<Pager>` for infinite scroll,
  and update mutations to match**
  - Replace the deck-detail card list's `useFetch`/`deckDetail`/
    `fetchDeckDetail`/`cardPage`/`goToCardPage`/`<Pager>` mechanism with the
    same accumulating-ref + `$fetch` + `IntersectionObserver` mechanism
    35a/35b built (`deckCards` ref, `deckLabel` ref, `initialPending`/
    `initialError`/`loadingMore` refs, a `sentinelRef` watched via
    `IntersectionObserver`, set up in `onMounted`, torn down in
    `onUnmounted`). Set `loadingMore = true` synchronously before the
    `await` (35a/35b's noted duplicate-append risk).
  - `watch([selectedId, cardSearchQuery], () => loadFirstDeckCardsPage())`
    replaces the URL-based `cardPage` reset from Step 2; `?cardPage=` is
    dropped entirely.
  - Update the five call sites that currently call `fetchDeckDetail()` after
    a mutation:
    - `removeCardFromManualDeck` - filter the removed card out of
      `deckCards.value` in place (matches `cards/index.vue`'s `removeCard`).
    - `onPreviewCardUpdated` - replace the matching card in `deckCards.value`
      in place (matches `cards/index.vue`'s `replaceCard`).
    - `downloadMedia` - same in-place replace, using the updated card object
      `downloadMediaBase` already returns (matches `cards/index.vue`'s own
      `downloadMedia`, which already does this).
    - `addCardToCurrentDeck` and `closeAddAnimeModal` - call
      `loadFirstDeckCardsPage()` (fresh first load), matching how 35b's
      create/rename/delete reload fresh rather than patching in place.
  - *Done when:* opening a deck with more than one page's worth of cards
    shows the first page, then scrolling to the bottom loads and appends the
    next page automatically until exhausted. Searching mid-scroll resets to
    a fresh first load (not "Loading more..."). Removing a card, editing one
    via Preview, and downloading media all update the visible list
    correctly without a full reload. Adding a card (either add-card flow)
    refreshes the list from the top. No duplicate or skipped cards across
    loaded pages. A simulated fetch failure on the first/query-driven load
    shows the existing error state; a failure on a scroll-triggered load
    doesn't wipe already-loaded cards. The top-level list (35a/35b) is
    completely unaffected. `bun run build` passes.

- [x] **Step 3.5 - fix search input losing focus/mobile keyboard on every
  keystroke** - found via live mobile testing (typing appeared to "vanish").
  The `<input v-model="cardSearchInput">` was placed inside the `v-else`
  branch gated on `cardsInitialPending`, which `loadFirstDeckCardsPage()`
  sets `true` synchronously on every debounced query change - unmounting and
  remounting the input element (and therefore losing focus / dismissing the
  on-screen keyboard on mobile) on every search keystroke. 35a/35b's own
  search inputs are correctly placed *above* their equivalent pending-gated
  block, so this was a deviation from the established pattern, not a shared
  defect - fixed by moving the input above `cardsInitialPending`'s check, to
  match. *Done when:* the search box never unmounts while typing, on mobile
  or desktop; `bun run build` passes.

- [x] **Step 4 - delete the now-dead `Pager.vue`**
  - Confirm no remaining references (`grep -rl "Pager" nuxt-app/app`), then
    delete `nuxt-app/app/components/Pager.vue`.
  - *Done when:* the file is gone, `grep` finds no references, and
    `bun run build` still passes (Nuxt's auto-import means no explicit
    import statement needs removing elsewhere).

## Files / areas

- `nuxt-app/server/utils/cards.ts` - export `cardSearchCondition`;
  `listCardsByArtist`/`listCardsByAnime`/`listCardsByManualDeck` gain the
  `query` filter.
- `nuxt-app/server/api/decks/cards.get.ts` - reads and forwards `q`.
- `nuxt-app/app/pages/decks/index.vue` - deck-detail card list gains a
  search input and infinite scroll; five mutation call sites updated. Every
  other piece of this file (top-level list, add-card search, export block,
  toggle/create/rename/delete) is untouched.
- `nuxt-app/app/components/Pager.vue` - deleted (Step 4).

## Data / contracts

- `GET /api/decks/cards` request gains an optional `q: string` query param,
  applied identically across all three `type` values. Response shape
  (`{ deckLabel, cards, page, totalPages }`) is unchanged.
- No schema changes.

## Testing

No test runner is configured (`AGENTS.md` has no `test` command). The new
server-side filter reuses the existing, already-shipped
`cardSearchCondition` logic rather than adding new pure logic - a fine
backfill candidate once `/tests` sets up a runner, but nothing new to test
in isolation here. Verify via direct `GET /api/decks/cards?type=...&id=...
&q=...` requests (Step 1, all three types) and a manual browser pass (Steps
2-4: search, scroll-loading, all five mutation paths, and the top-level
list regression check), plus `bun run build` at every step.

## Notes for the AI

- Mirror `cards/index.vue`'s and `decks/index.vue`'s **actual shipped**
  top-level-list implementations (not just their archived spec prose) for
  the debounce, accumulating-ref, and `IntersectionObserver` shape - read
  both files directly as the reference.
- This page now has three independent search boxes and two independent list
  surfaces after this feature (top-level list, deck-detail list, plus the
  unrelated add-card search) - keep variable names distinct
  (`cardSearchQuery` vs. `searchQuery` vs. `addCardQuery`) so it stays
  readable, and don't let deck-detail changes touch the top-level list's own
  `rawDecks`/`loadFirstPage`/`loadMoreDecks` at all.
- `listCardsByManualDeck` already joins `deckCard`; combining its scope
  condition with `cardSearchCondition(query)` needs `and(eq(deckCard.deckId,
  deckId), condition)` when a query is present, same shape as the
  artist/anime variants.
