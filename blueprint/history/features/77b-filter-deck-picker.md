# Feature: Pick shows + add to deck

**From build-plan:** feature 77b (parent: 77. Build a deck from filters)
**Status:** verified

## Goal

Let a manual deck be filled from Study's filters: pick filters (for example
the "Cute Girls Doing Cute Things" tag), see which library shows match and how
many cards each would add, untick any you don't want, and add the rest in one
action. Available on an existing manual deck's detail view and on the
"+ New deck" form, next to feature 73's "Import from deck". Builds on 77a's
`StudyFilterForm` and `POST /api/decks/filter-preview`.

## In scope

- `copyFilteredCards(deckId, animeIds, filters)` (server): links into the deck
  every card of the picked anime that matches the filters, as one
  INSERT ... SELECT, and reports added / already-in-deck counts. Plus
  `parseCopyFilteredBody` validating its request.
- `POST /api/decks/copy-filtered` wrapping them.
- `DeckFilterCardsModal.vue`: the filter form beside a live list of matching
  shows (cover, title, year/format, card count), each with a checkbox, all
  ticked by default, plus Tick all / Untick all, a running "N shows, M cards"
  total, and Add. A summary line after adding, then Done.
- A "From filters" button on a manual deck's Add cards block (beside "Import
  from deck"), and a "From filters..." button on the "+ New deck" form (beside
  "Import cards..."), which names and creates the deck first like feature 73's
  create mode.

## Out of scope

- Live/smart decks or storing a deck's filters (decided: one-time snapshot).
- Anime without cards, or importing new shows from AniList (decided: library
  only).
- Prefilling from, or writing to, Study's saved filters
  (`gaqSrs:studyFilters`). The modal always opens with empty filters.
- Picking individual cards inside a show. OP/ED in the filters is the only
  per-card narrowing.
- The `themesOnly` setting (same call as 77a and feature 73: it limits Study,
  not decks).
- Artist and anime decks (derived, cannot hold cards), and deck export.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `copyFilteredCards` + `parseCopyFilteredBody` + tests** - in
  `server/utils/deckFilterPreview.ts`. The parser takes `{ deckId, animeIds,
  filters? }`: `deckId` a positive integer; `animeIds` a non-empty array of
  positive integers, deduplicated, at most 5000; `filters` passed to
  `parseStudyFilters` unchanged (a string or absent). The copy checks the deck
  exists (else `{ notFound: true }`), then in one transaction counts and
  inserts `card.id` from card join song join anime where
  `studyFilterCondition(filters)` and `anime.id in animeIds`, `on conflict do
  nothing`, like `copyCardsFromDecks`. *Done when:* `bun run test` passes
  with cases: adds exactly the preview's cards for the picked anime and none
  from unpicked ones; an OP-only filter adds only OP cards; a second run adds
  0 with every card counted as already in the deck; a card already in the deck
  from elsewhere counts as already-in-deck; an unknown deck is `notFound`; an
  anime id that no longer exists adds nothing and does not error; the parser
  rejects a missing/zero deckId, an empty or non-integer `animeIds`, more than
  5000 ids, and bad filters (the `parseStudyFilters` message passes through),
  and dedupes repeated ids.
- [x] **Step 2 - `POST /api/decks/copy-filtered`** - new
  `server/api/decks/copy-filtered.post.ts`: parse, `400` with the parser's
  message, `404` "Deck not found", else the result. *Done when:* `curl`
  against the dev server on a throwaway manual deck returns `{ added,
  alreadyInDeck }`, a repeat returns `added: 0`, a bad body returns `400` and
  an unknown deck `404`; the throwaway deck is deleted afterwards.
- [x] **Step 3 - `DeckFilterCardsModal` preview, wired to deck detail** - new
  `components/deck/DeckFilterCardsModal.vue` for an existing deck only:
  `StudyFilterForm` on the left, matching shows on the right (stacked below
  820px), from `POST /api/decks/filter-preview`, refetched 300ms after the
  last filter change and not while `studyFiltersProblem` reports a problem.
  Out-of-order responses are dropped (only the latest request's answer is
  shown). Loading, error, and "No shows in your library match these
  filters." states. Read-only list in this step: no checkboxes, no Add. A
  "From filters" button beside "Import from deck" on a manual deck's detail
  view opens it; Escape, the close button, and the backdrop close it.
  *Done when:* in a browser, "From filters" opens the modal listing every
  library show with cards (92 at spec time) and a total; picking the "Cute
  Girls Doing Cute Things" tag narrows the list and totals to match `curl`
  on the preview route with the same filters; an impossible year range
  shows the form's problem message and keeps the last list; no console
  errors.
- [x] **Step 4 - pick shows + Add** - a checkbox per show, all ticked by
  default. Unticked shows are stored as a set of unticked ids, so a show that
  newly matches after a filter change arrives ticked and an unticked one stays
  unticked if it still matches. Tick all / Untick all; footer "N shows, M
  cards" over ticked shows only. Add sends the filters of the list currently
  shown (not a newer draft still debouncing) and the ticked anime ids, and is
  disabled while a preview is loading, while nothing is ticked, or while the
  form has a problem. After adding: summary "Added N cards (M already in
  deck).", the button label becomes Done, and the page reloads the deck's card
  list and bumps its tile count through the existing `onCardsCopied`. On
  failure, the error shows inline and the picks are kept. *Done when:* in a
  browser, on a throwaway manual deck, filtering to the CGDCT tag, unticking
  one show, and adding puts exactly the remaining shows' cards in the deck
  (the summary count equals the footer's card count and the deck list shows
  them); re-opening and adding again reports 0 added, all already in deck;
  the throwaway deck is deleted afterwards.
- [x] **Step 5 - create mode on "+ New deck"** - a `create` prop like
  `DeckCopyCardsModal`'s: a name input, and Add becomes "Create and add",
  which creates the deck (`POST /api/decks`) and then copies into it. The
  deck is kept if the copy fails ("Deck created, but adding cards failed:
  ..."), and a retry adds into it. A "From filters..." button beside "Import
  cards..." on the "+ New deck" form opens it, and the grid reloads when the
  modal closes after a deck was created, reusing the page's existing
  `createdViaImport` / `closeCreateWithImport` handling. A duplicate name
  shows the server's error and creates nothing. *Done when:* in a browser,
  "+ New deck" -> name -> "From filters..." -> filter -> "Create and add"
  creates the deck with the expected card count on its tile after closing;
  a duplicate name shows an error with no deck created and no cards added;
  the throwaway deck is deleted afterwards. `bun run build` and `bun run
  test` pass.

## Files / areas

- `nuxt-app/server/utils/deckFilterPreview.ts` (+ `.test.ts`) - copy and parser
- `nuxt-app/server/api/decks/copy-filtered.post.ts` (new)
- `nuxt-app/app/components/deck/DeckFilterCardsModal.vue` (new)
- `nuxt-app/app/pages/decks/index.vue` - two buttons, two modal instances,
  `onCardsCopied` typed to accept this result too
- Reused as is: `StudyFilterForm.vue`, `POST /api/decks/filter-preview`,
  `app/utils/studyFilters.ts` (`EMPTY_STUDY_FILTERS`, `filtersQueryValue`,
  `studyFiltersProblem`)

## Data / contracts

No schema change, no migration. Only `DeckCard` rows are added.

`POST /api/decks/copy-filtered`

```ts
// body
{ deckId: number; animeIds: number[]; filters?: string } // filters: same JSON string as /api/study/next
// 200
interface CopyFilteredResult { added: number; alreadyInDeck: number }
// 400 { statusMessage } | 404 "Deck not found"
```

The contract that makes the preview trustworthy: for the same `filters` and
anime, `copyFilteredCards` inserts exactly the cards `listFilteredAnime`
counted. Both must build their condition from `studyFilterCondition` and the
same card-song-anime join; step 1's first test pins it.

Client copies of `FilteredAnime` / `FilteredAnimePreview` (from 77a) and
`CopyFilteredResult` live in `DeckFilterCardsModal.vue`, fields in the
server's order (F-09 convention).

## Testing

Vitest is configured, so the gate is on.

- **Step 1** is in-scope logic and ships tests in
  `deckFilterPreview.test.ts` (cases in the step), including one that compares
  `copyFilteredCards`' added count against `listFilteredAnime`'s card counts
  for the same filters.
- **Step 2** is a thin route: `curl` evidence.
- **Steps 3-5** are UI: browser evidence with `playwright-cli` in its own
  in-memory profile (screenshots, console errors), against throwaway decks
  that are deleted afterwards so the real library is left as it was. Build
  and the full test suite at the end.

## Notes for the AI

- Server: SQL stays in `server/utils/`; routes only parse and call. Do not
  touch `copyCardsFromDecks` or `/api/decks/copy-cards`.
- Keep the new modal's shell styling consistent with `DeckCopyCardsModal`
  (backdrop, panel, close button, footer buttons, summary, inline error), but
  wider (two columns) since the filter form is tall. Tokens only, no inline
  styles, no new tokens.
- Build a new modal rather than adding a mode to `DeckCopyCardsModal`: the two
  pickers share nothing but the shell. The ~15-line create-then-copy helper is
  duplicated from `DeckCopyCardsModal`; do not refactor that modal in this
  feature.
- The filter state is the modal's own draft, reset to `EMPTY_STUDY_FILTERS`
  and the ticks cleared every time the modal opens. Never read or write
  `gaqSrs:studyFilters`.
- Covers use `coverImageUrl` with no image when null, as elsewhere on
  `/decks`. The list can hold every library show (about 100), so no
  pagination; it scrolls inside its column.
- Steps 3-5 test against the real dev database; every deck created for
  evidence is deleted in the same step, and no existing deck is modified.
- No em dashes in copy, comments, or commit messages.
