# Feature: Pagination

**From build-plan:** feature 19a
**Status:** verified

## Goal

Numbered-page pagination (~25/page) for the three lists that grow with the
library: the top-level `/cards` list, the top-level `/decks` list, and the
card list inside a deck's detail view. Keeps load times reasonable as the
library grows past what one page can comfortably show.

## In scope

- A small server-side pagination helper (fixed page size 25, 1-based `page`
  query param, clamped to a valid range) reused by all three paginated
  endpoints.
- `GET /api/cards`, `GET /api/decks`, and `GET /api/decks/cards` all accept
  `?page=` and return the requested page plus enough info (`page`,
  `totalPages`) for the client to render page controls - never the whole
  list at once past the first 25 rows.
- One shared `Pager` component (numbered buttons + Prev/Next), reused by
  all three lists rather than three copies of the same markup.
- Page state lives in the URL (`?page=` for the list you're on, `?cardPage=`
  for the card list inside a selected deck, so the two don't collide when
  both could theoretically appear in the same query string) - consistent
  with this app's existing query-string-for-navigation-state convention.
- A pager is only visible when there's more than one page; a list with 25
  or fewer items renders exactly as it does today, no controls shown. This
  is what makes "pagination past 10 entries" true in practice: anything
  under the 25/page size never produces a second page to control.

## Out of scope

- Ellipsis/windowing for very large page counts (e.g. "1 2 3 ... 18 19
  20") - every page gets its own button. Fine at this library's realistic
  scale; revisit if it ever grows large enough to matter.
- A "jump to page N" input - clicking a numbered button is the only way to
  change pages, matching "numbered pages" as scoped.
- A client-configurable page size - fixed at 25 server-side.
- `GET /api/decks/memberships` (the per-card deck-membership lookup map
  behind `/cards`' "Decks" checkbox panel) - it's a lookup map keyed by
  card id, not a displayed list, so it's unrelated to this feature's goal.
- `/api/decks/export` and `/api/study/next` - unaffected. Export queries
  the DB directly (never called `listCardsByArtist`/etc.), and study's
  due-card query needs the single next-due card, not a page of them.
- Global search (19b) - separate sub-feature, picked up on its own
  `/feature` run.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server: pagination helper + `/api/cards`** - add
  `server/utils/pagination.ts` exporting `PAGE_SIZE = 25` and
  `parsePage(raw: unknown): number` (defaults/clamps to `1` for
  missing/invalid/non-positive input). Change `listCards` to accept a
  `page` argument and return `{ items, total }` (a `count(card.id)` query
  alongside the existing `.limit(PAGE_SIZE).offset((page-1)*PAGE_SIZE)`
  query, same ordering as today). Update `server/api/cards.get.ts` to read
  `?page=`, clamp it to `[1, totalPages]` once `totalPages` is known, and
  return `{ cards, page, totalPages }`. *Done when:* `curl
  /api/cards?page=1` (and `?page=2`, and an out-of-range `?page=999`)
  returns the right slice, correct `totalPages`, and a clamped `page` in
  the response; omitting `?page=` behaves exactly like `?page=1`.

- [x] **Step 2 - Client: `/cards` pagination UI** - add
  `app/components/Pager.vue` (props `page`, `totalPages`; emits `change`
  with the target page number; renders nothing when `totalPages <= 1`).
  In `app/pages/cards/index.vue`, read `page` from `route.query.page`
  (default `1`), include it in the existing `useFetch("/api/cards", ...)`
  query, and render `<Pager>` below the card list, bound to the server's
  echoed `page`/`totalPages` and pushing a new `?page=` on `change`.
  *Done when:* in the browser, `/cards` with more than 25 cards shows a
  pager; clicking a page number or Prev/Next loads that page and updates
  the URL; a library with 25 or fewer cards shows no pager at all.

- [x] **Step 3 - Server: `/api/decks` (top-level list) pagination** -
  change `listArtistDecks`, `listAnimeDecks`, and `listManualDecks`
  (`server/utils/decks.ts`) to accept `page` and return `{ items, total }`
  the same way - `total` via `countDistinct(artist.id)` /
  `countDistinct(anime.id)` for the two grouped queries, plain
  `count(deck.id)` for manual decks. Update `server/api/decks.get.ts` to
  read/clamp `?page=` and return `{ decks, page, totalPages }` for all
  three `type` values. *Done when:* `curl` against each of
  `?type=artist`, `?type=anime`, `?type=created` with `?page=` behaves
  like Step 1's checks, for each type independently.

- [x] **Step 4 - Client: `/decks` top-level list pagination UI** - in
  `app/pages/decks/index.vue`, read `page` from `route.query.page`
  (default `1`), add it to the existing top-level `useFetch("/api/decks",
  ...)` query, and render `<Pager>` below the deck list, wired the same
  way as Step 2. Switching tabs (`setType`) already resets the full query
  string today, so it also resets `page` to unset (page 1) - no extra
  code needed for that. *Done when:* in the browser, a tab (Artist/Anime/
  Created) with more than 25 entries shows a pager that works; switching
  tabs resets to page 1; a tab with 25 or fewer entries shows no pager.

- [x] **Step 5 - Server: `/api/decks/cards` (deck-detail card list)
  pagination** - change `listCardsByArtist`, `listCardsByAnime`, and
  `listCardsByManualDeck` (`server/utils/cards.ts`) to accept `page` and
  return `{ items, total }` (plain `count(card.id)` with the same
  WHERE/JOIN as each function already has - no grouping involved here,
  unlike Step 3). Update `server/api/decks/cards.get.ts` to read/clamp
  `?page=` and return `{ deckLabel, cards, page, totalPages }`. *Done
  when:* `curl` against a deck (of each type) with `?page=` behaves like
  Step 1's checks.

- [x] **Step 6 - Client: `/decks` detail-view card list pagination UI** -
  in `app/pages/decks/index.vue`, read a separate `cardPage` from
  `route.query.cardPage` (default `1`, distinct from the list's own
  `page` so the two can't collide), add it to the existing `deckDetail`
  `useFetch` query, and render `<Pager>` below the card list in the
  detail view, wired the same way. Selecting a deck or going back to the
  list already resets the query string today, so `cardPage` resets too -
  no extra code needed. *Done when:* in the browser, a deck with more
  than 25 cards shows a working pager in its detail view; selecting a
  different deck resets to page 1; a deck with 25 or fewer cards shows no
  pager.

## Files / areas

- `nuxt-app/server/utils/pagination.ts` - new, shared helper.
- `nuxt-app/server/utils/cards.ts` - `listCards`,
  `listCardsByArtist`/`listCardsByAnime`/`listCardsByManualDeck`.
- `nuxt-app/server/utils/decks.ts` - `listArtistDecks`, `listAnimeDecks`,
  `listManualDecks`.
- `nuxt-app/server/api/cards.get.ts`, `decks.get.ts`,
  `decks/cards.get.ts`.
- `nuxt-app/app/components/Pager.vue` - new, shared across all three
  lists.
- `nuxt-app/app/pages/cards/index.vue`, `nuxt-app/app/pages/decks/index.vue`.

## Data / contracts

```ts
// server/utils/pagination.ts
export const PAGE_SIZE = 25;
export function parsePage(raw: unknown): number; // clamps to >= 1, defaults to 1
```

Every paginated list function returns `{ items: T[]; total: number }`;
every paginated endpoint returns its existing array key plus `page` (the
clamped/effective page actually used) and `totalPages`
(`Math.max(Math.ceil(total / PAGE_SIZE), 1)`):

```ts
GET /api/cards?page=<n>            -> { cards: CardWithDetails[], page: number, totalPages: number }
GET /api/decks?type=&page=<n>      -> { decks: ArtistDeck[] | AnimeDeck[] | ManualDeck[], page: number, totalPages: number }
GET /api/decks/cards?type=&id=&page=<n> -> { deckLabel: string, cards: DeckCard[], page: number, totalPages: number }
```

`Pager` component props/emit:

```ts
defineProps<{ page: number; totalPages: number }>();
defineEmits<{ change: [page: number] }>();
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test`
entry). Steps 1/3/5 (server) ride on `curl` evidence against the dev
server - out-of-range and default-page clamping is pure logic with a clear
right/wrong answer, a good candidate to backfill once `/tests` sets up a
runner. Steps 2/4/6 (client) are UI - no browser tool has been available
in any step this whole conversation, so I'll verify what SSR HTML
(`useFetch` renders server-side on these pages, unlike `/study`) and
`bun run build` can confirm, and flag anything that still needs your eyes.

## Notes for the AI

- `listCardsByArtist`/`listCardsByAnime`/`listCardsByManualDeck` are used
  *only* by `decks/cards.get.ts` - confirmed via a repo-wide search before
  writing this spec. Nothing else (export, study) depends on getting the
  full unpaginated list from these three functions, so changing their
  return shape is safe.
- Compute `total` with the *same* WHERE/JOIN conditions as the paginated
  query, just without `.limit()`/`.offset()` - don't let the two drift
  apart into inconsistent counts.
- `parsePage` clamping handles the lower bound (`< 1` -> `1`); each
  endpoint still separately clamps the upper bound once `totalPages` is
  known (`page > totalPages` -> `totalPages`), since that number isn't
  available until after the total-count query runs.
- Reuse `Pager.vue` for all three lists - don't write three separate pager
  markups. It has no feature-specific styling or logic, so it belongs at
  `app/components/Pager.vue` (no feature subfolder), unlike
  `card/CardPreviewModal.vue`.
