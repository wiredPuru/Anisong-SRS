# Feature: Add new anime cards from a deck page

**From build-plan:** feature 33
**Status:** verified

## Goal

Let a manual deck's detail view create a brand-new card straight from an
AniList lookup, not just attach cards that already exist. Feature 28 already
covers searching and attaching *existing* cards from the deck page; this adds
the other half - look up an anime that has no card yet, import it, and land
the new card directly in the current deck, without ever leaving the deck
page.

## Design note (revised after first pass)

The first implementation had two separate search boxes on the deck page
("Add cards" and "Add a new anime") and sent the user off to `/cards/new`
via a `deckId` query param to finish adding an anime's cards. User feedback
after review: one search box, and picking an anime should never navigate
away - closing out of it (Cancel or Done) always lands back on the deck
page, because you never left it. Redesigned as:

- One unified search box (merging into the existing "Add cards" box) that
  searches local cards first, and falls back to an AniList search when
  there are no local matches - same empty-then-fallback pattern the nav
  bar's global search already uses (feature 26).
- An AniList result opens an in-page modal (`DeckAddAnimeModal.vue`, new
  component, following the existing `CardPreviewModal.vue` pattern) that
  imports the anime, lists its OP/ED themes, and lets you add a card per
  theme - each add auto-attaches to the deck, same as before. Cancel and
  Done both just close the modal; the deck page underneath is unchanged and
  its card list/search reset once the modal closes.
- `/cards/new` and its nav-bar-triggered flow (feature 26) are untouched -
  the `deckId` query-param mechanism from the first pass was removed
  entirely rather than left as dead code.

## In scope

- Merge the deck page's existing "Add cards" search (feature 28) with a
  new-anime fallback: when a query has no local card matches, search
  AniList and show those results in the same box, grouped separately.
- A new `DeckAddAnimeModal.vue` component: opened by selecting an AniList
  result, imports the anime via the existing lookup/import route, lists its
  themes, and adds+attaches a card per theme on demand (same underlying
  calls as before: `POST /api/cards` then `POST /api/decks/cards`).
- Cancel and Done controls (plus Escape and backdrop click, matching
  `CardPreviewModal`'s existing convention) close the modal without any
  navigation; closing refreshes the deck's card list and membership map so
  newly added cards show up immediately.
- A distinct error message if a card is created but the attach call fails,
  so the user isn't left thinking it landed in the deck when it didn't.
- Download-to-local actions (video/audio) for cards added in the modal,
  reusing feature 8's existing `useCardDownloads()` composable.
- The same download actions on every card already listed in a deck's
  detail view (not just ones just added), so download isn't only reachable
  through the add-new-anime modal - feature 8 already put this on `/cards`,
  and it was missing from the deck detail card list.

## Out of scope

- Bulk-importing an entire artist's catalog in one action (the open question
  already flagged in `project-overview.md` - its own future feature, not
  this one).
- Any change to `/cards/new`'s existing behavior (feature 26's nav-bar "Add
  a show" flow, and plain `/cards/new` visits, are untouched - the earlier
  `deckId` param addition there was reverted).
- Adding new cards from artist/anime (derived) deck views - manual decks
  only, same restriction feature 28 already applies (nothing to attach to
  on a derived grouping).
- A local video/audio path *input* field in the modal's per-theme "Add"
  action (`/cards/new`'s theme rows have one; this modal's rows don't) -
  download-after-add (Step 4) covers pulling a remote source local, so a
  manual path field stays deferred.
- Any new server route - this reuses `/api/lookup/anilist-search`,
  `/api/lookup/import`, `/api/cards` (POST), and `/api/decks/cards` (POST)
  exactly as they exist today.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 (superseded, see below)** - originally: separate AniList
  search block navigating to `/cards/new?aniListId=&deckId=`. Replaced by
  the merged-search + modal design after review.
- [x] **Step 2 (superseded, see below)** - originally: `deckId` handling
  and auto-attach on `/cards/new`. Reverted; `/cards/new` is back to its
  pre-feature state.
- [x] **Step 3 - Merge the deck-page search and add the modal** - in
  `app/pages/decks/index.vue`: merge `addCardQuery`'s existing local-card
  search with an AniList fallback (mirroring `NavBar.vue`'s
  `runSearch`/generation-guard pattern) shown as a second, separately
  labeled group when local results are empty; selecting an AniList result
  opens a new `DeckAddAnimeModal` instead of navigating. Build
  `app/components/deck/DeckAddAnimeModal.vue`: on open, imports the target
  anime, lists its themes, adds+attaches a card per theme with per-row
  "Added" / attach-error states, and exposes Cancel/Done (plus
  Escape/backdrop-click) to close. Closing refreshes the deck's card list
  and membership map. Revert `app/pages/cards/new.vue`'s `deckId` handling
  from the superseded steps. *Done when:* on a manual deck's detail page, a
  query with no local card matches shows an "Add a new anime" group of
  AniList results; selecting one opens the modal without navigating;
  adding a theme's card lands it in the deck's card list once the modal is
  closed (Cancel or Done); `/cards/new` (with or without other params) has
  no `deckId` handling left.
- [x] **Step 4 - Download video/audio for cards added in the modal** - wire
  `DeckAddAnimeModal.vue` into the existing `useCardDownloads()` composable
  (feature 8), exactly as `app/pages/cards/new.vue` already does: fetch
  `/api/media-library` for `defaultDownloadFolder`, and once a theme's card
  is added, show a "Download video"/"Download audio" button (gated on that
  source existing remotely and not already being local) with the same
  progress-bar and error states, or a hint to set a default download
  folder when none is configured. State resets alongside the rest of the
  modal's per-open state. *Done when:* after adding a theme's card in the
  modal, a download button appears for each remote source it has, clicking
  one streams progress and ends with the card's local path set - verified
  by replaying the exact `POST /api/cards/download` call the button makes
  against a scratch dev server and confirming the returned card has
  `localAudioPath` set.
- [x] **Step 5 - Download actions on the deck's existing card list** - in
  `app/pages/decks/index.vue`, wire the same `useCardDownloads()` +
  `/api/media-library` machinery (mirroring `app/pages/cards/index.vue`'s
  existing per-row download UI, keyed by `c.id` since these are already-
  existing cards, not import-time themes) into the `deckDetail.cards` list
  every deck type renders (Artist/Anime/Created) - a "Download video"/
  "Download audio" button per card that has a downloadable remote source,
  with the same progress and error states, or the same "set a default
  download folder" hint. A successful download re-fetches the deck detail
  so the badges and buttons update. *Done when:* opening any deck's detail
  view (not just right after adding a card) shows a download button for
  each card with an undownloaded remote source; clicking one downloads it
  and the button disappears once that source is local - verified against a
  scratch dev server by downloading a pre-existing deck card's audio via
  the actual `POST /api/cards/download` call and confirming the SSR'd deck
  page afterward shows only the remaining "Download video" button for that
  card.

## Files / areas

- `nuxt-app/app/pages/decks/index.vue` - merged search box, modal trigger
  state, refresh-on-close (Step 3); download actions on the deck's card
  list (Step 5).
- `nuxt-app/app/components/deck/DeckAddAnimeModal.vue` - new component;
  Step 4 added download actions per theme.
- `nuxt-app/app/pages/cards/new.vue` - reverted to its pre-feature state.

## Data / contracts

None new. Reuses existing shapes and routes as-is:

- `GET /api/lookup/anilist-search` (`{ results: AniListResult[] }`)
- `POST /api/lookup/import` (`{ aniListId }` -> `ImportResult`)
- `POST /api/cards` (`CardWithDetails`)
- `POST /api/decks/cards` (`{ deckId, cardId }`)
- `GET /api/media-library`, `POST /api/cards/download` (feature 8's
  download composable, `useCardDownloads()`)

## Testing

No test runner is configured in `AGENTS.md` yet, so this rides on browser
and API-level verification, not a unit-test gate: the whole feature is
UI/routing/integration behavior (a fetch call, a modal, a refresh), not
pure logic with a right/wrong answer. Verified via `bun run build`, SSR
content checks for the new UI strings, and replaying the exact API call
sequences the modal makes - import -> create card -> attach -> confirm via
`/api/decks/memberships`, and create card -> `/api/cards/download` ->
confirm the returned card's local path is set - against a scratch dev
server, cleaning up test data (and downloaded files) afterward.

## Notes for the AI

- `DeckAddAnimeModal.vue` lives under `components/deck/` with a `Deck`-
  prefixed filename so Nuxt's auto-import prefix-stripping resolves it to
  `<DeckAddAnimeModal>` cleanly - same reasoning feature 11 documented for
  `components/card/CardPreviewModal.vue`.
- Follow `CardPreviewModal.vue`'s existing modal conventions: `.backdrop`/
  `.panel` classes, `@click.self` to close, `useHotkeyGuard` + `Escape` to
  close, `var(--token)` styling only.
- `POST /api/decks/cards` is already idempotent (feature 13b) - safe to
  call even if a re-added card were somehow already a member, though that
  shouldn't happen for a card just created this call.
- `selectedId` (already in scope in `decks/index.vue`) is the current
  manual deck's id - pass it to the modal as `deckId`, don't re-derive it.
