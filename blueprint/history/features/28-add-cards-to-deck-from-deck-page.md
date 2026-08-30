# Feature: Add existing cards to a deck from the deck page

**From build-plan:** feature 28
**Status:** verified

## Goal

Today the only way to attach a card to a manual deck is from `/cards`' own
"Decks" checkbox panel (feature 13b) - there's no way to do it from the deck
side. This feature adds that missing direction: a search-and-add control on a
manual deck's detail view (`/decks?type=created&id=`) that finds existing
cards and attaches them, reusing the same endpoints that already power the
`/cards` checkbox panel and the global search bar.

## In scope

- On a manual deck's detail view only (`activeType === 'created'` -
  artist/anime decks are derived, not stored, so there's nothing to "add" a
  card to there): a search box that queries `GET /api/search` (the existing,
  cards-only search endpoint from feature 26's fix) and lists matching
  cards.
- Each result shows an "Add" button, or an "Added" badge if the card is
  already in this deck (checked against `GET /api/decks/memberships`, the
  same site-wide membership map `/cards`' checkbox panel already fetches -
  not against the deck detail's own paginated card list, which wouldn't
  reliably reflect membership for cards on a page not currently loaded).
- Clicking "Add" calls the existing `POST /api/decks/cards` (feature 13b,
  already idempotent server-side via `onConflictDoNothing()`), then
  refetches the deck's card list and the membership map so the result
  immediately flips to "Added" and the visible card list updates - without
  clearing the search box, so adding several matches in a row doesn't
  require re-typing the query each time.
- Same debounce/minimum-query-length convention as the global nav search
  (250ms, 2+ characters) for consistency.

## Out of scope

- Any change to `/api/search`, `/api/decks/cards`, or `/api/decks/memberships`
  - all three already do exactly what this feature needs; this is a
  client-only feature composing existing endpoints, same pattern as feature
  26's nav-search-fallback.
- Adding a *new* card (via AniList/animethemes lookup) from the deck page -
  that's `/cards/new`'s job; this feature only attaches cards that already
  exist.
- Artist/Anime deck detail views - unchanged, no add control there (they're
  derived groupings, not stored decks).

## Build steps

- [x] **Step 1 - Search-and-add control on a manual deck's detail view** -
  In `app/pages/decks/index.vue`:
  - Fetch `GET /api/decks/memberships` (same shape `/cards` already uses)
    alongside the page's existing `useFetch` calls.
  - Add search state (`addCardQuery`, `addCardResults: DeckCard[]`,
    `addCardPending`, `addCardError`, `addingCardId`) and a 250ms-debounced
    handler that calls `GET /api/search?q=` for a 2+ character query,
    mirroring `NavBar.vue`'s existing debounce pattern.
  - Add `addCardToCurrentDeck(cardId)`: `POST /api/decks/cards` with
    `{ deckId: selectedId, cardId }`, then re-run `fetchDeckDetail()` and
    the memberships fetch so the card list and "Added" state both update.
    Errors surface through a new `addCardError` display, matching the
    file's existing `export-error`/`extractErrorMessage` pattern.
  - Reset `addCardQuery`/`addCardResults`/`addCardError` when switching decks
    (in `selectDeck()`/`backToDecks()`), matching the existing reset of
    `exportSummary`/`exportError` there.
  - Template: a new block, guarded by `v-if="activeType === 'created'"`,
    placed after the deck detail header and before the existing card list -
    search input, pending/error/empty states, and a result list where each
    row shows the card's title/artist/anime plus an "Add" button (disabled
    while that specific card is being added) or an "Added" badge when
    `membershipsData` already lists this deck for that card's id.
  *Done when:* on a manual deck's detail view, searching an existing card
  not yet in this deck shows an "Add" button; clicking it attaches the card
  - the deck's card list (and count) updates, and that search result
  immediately shows "Added" instead, without needing to re-search. A card
  already in the deck shows "Added" from the first search, not "Add". A
  query with zero matching cards shows a "No matching cards." message, not
  a blank list or a stuck spinner. Switching to a different manual deck (or
  back to the deck list and into another) clears the previous search box
  and results rather than showing stale results from the prior deck.
  Searching from an *artist* or *anime* deck's detail view shows no such
  control (unchanged from today). Adding a card already in the deck (e.g.
  clicking a stale "Add" before a refetch lands) doesn't error, since the
  server side is already idempotent.

## Files / areas

- `nuxt-app/app/pages/decks/index.vue` - the only file touched.
- No server changes - reuses `GET /api/search`, `POST /api/decks/cards`,
  `GET /api/decks/memberships` exactly as they exist today.

## Data / contracts

- No schema or type changes. Search results reuse the existing
  `CardWithDetails` shape (already present in this file as `DeckCard`, same
  fields) returned by `GET /api/search`.

## Testing

No test runner is configured in `AGENTS.md`, so this rides on manual/curl
verification and build evidence, same as recent work in this area:

- `curl "/api/search?q=<existing card's song title fragment>"` - confirm it
  returns that card (already proven working by feature 26/its fix, just
  confirming the exact query this feature will send).
- In the browser: open a manual deck's detail view, search for a card not in
  it - "Add" appears; click it - the card list updates and the result flips
  to "Added". Search for a card already in the deck - it shows "Added" from
  the start. Search a nonsense query - "No matching cards." shows. Switch to
  a different manual deck (or back and into another) - the previous search
  and results are cleared, not left showing stale data. Switch to an artist
  or anime deck's detail view - no search control appears.

## Notes for the AI

- Match this file's existing conventions exactly: `useFetch` for the initial
  memberships load, `$fetch` for the add mutation, `extractErrorMessage` for
  error display (already defined once in this file - reuse it, don't
  redefine it).
- `DeckCard` (this file's existing interface) and `CardWithDetails`
  (returned by `/api/search`) are the same shape - reuse `DeckCard` for
  search results rather than adding a duplicate type.
- The membership check must key off `GET /api/decks/memberships`'s map, not
  `deckDetail.cards` (which is paginated and won't reflect membership for
  cards outside the currently-loaded page).

## Verification evidence

- `bun run build` - clean at the step and at the final safety pass.
- End-to-end verified against isolated throwaway data: created a temp
  manual deck, confirmed `GET /api/search` found a real existing card,
  confirmed `GET /api/decks/memberships` listed no membership for that
  card/deck beforehand, called `POST /api/decks/cards` (the exact request
  the "Add" button sends), confirmed the membership map updated and the
  deck's card list (`GET /api/decks/cards?type=created&id=`) reflected the
  addition, then deleted the temp deck. The real card was left completely
  untouched throughout.
- Gap: Playwright is not installed in this project, so the actual click
  path (typing in the search box, clicking Add, watching the badge flip)
  was not exercised in a live browser - verified via the underlying API
  calls plus build evidence.

## Findings

None raised against this feature.
