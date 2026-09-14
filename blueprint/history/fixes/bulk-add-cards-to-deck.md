# Add selected cards to a deck from /cards

**Type:** Fix

**Status:** verified

**Branch:** `fix/bulk-add-cards-to-deck`

**Completed:** 2026-09-14

## The problem

Adding cards to a manual deck is a one-at-a-time job. Building a deck of 30
cards means 30 separate clicks, each in a different place:

- `/cards`' inspector rail has `DeckMembershipPanel` (feature 34), but it acts
  on the one card the inspector is showing, so every card means re-selecting a
  row first.
- `/decks`' manual-deck detail has an "Add cards" search (feature 28), but each
  result carries its own single "Add" button.

Meanwhile feature 61b already shipped exactly the selection UI this needs on
`/cards`: a checkbox per row, a tri-state header checkbox over the loaded rows,
shift-click ranges, and a sticky selection bar. That bar offers only **Delete**.
Nothing bulk-adds the selection to a deck.

The pieces are all present and none of them are wired together:

| Piece | Where | State |
|---|---|---|
| Row multi-select | `app/pages/cards/index.vue` (`checkedIds`) | Shipped, delete-only |
| Selection bar | same, `.selection-bar` | Shipped, delete-only |
| Single deck add | `POST /api/decks/cards` | Shipped, `{ deckId, cardId }` only |
| Membership map | `GET /api/decks/memberships` | Shipped, already loaded on `/cards` |

## The fix

Add an **"Add to deck"** control to `/cards`' existing selection bar: pick a
manual deck, and every checked card joins it in one action.

Scope is the `/cards` selection bar only. `/decks`' own "Add cards" search keeps
its per-result buttons, and `DeckMembershipPanel` in the inspector rail is left
exactly as it is - this adds a bulk path beside them, it does not replace either.

Design decisions:

- **Bulk body form on the existing route**, not a new route. `POST
  /api/decks/cards` accepts `{ deckId, cardIds }` alongside today's `{ deckId,
  cardId }`, mirroring how feature 61a taught `DELETE /api/cards` to accept
  `{ ids }` alongside `{ id }`. Body validation goes in its own parser with a
  test beside it, the same shape as `server/utils/cardDelete.ts`.
- **Idempotent, so re-adding is a no-op.** `addCardToDeck` already inserts with
  `onConflictDoNothing`, so a selection that mixes members and non-members needs
  no pre-filtering and cannot error.
- **The selection survives the add.** Unlike Delete, the cards still exist
  afterwards, so keeping them checked lets the same set go into a second deck.
- **No confirm step.** Adding to a deck is reversible and touches no files, so
  it does not earn the two-step confirm that Delete has.

Must not break:

- Bulk delete, the header checkbox, shift-click ranges, and `deleteAllMatching`.
- The inspector's `DeckMembershipPanel` - it reads `membershipsData`, which has
  to be refreshed after a bulk add so its checkboxes agree with reality.
- The single-card `{ deckId, cardId }` body, still used by
  `DeckMembershipPanel` on `/cards` and by `/decks`' own add flows.

## Build steps

### Step 1 - bulk add on the server  (done)

- New `server/utils/deckMembership.ts`: `BULK_DECK_ADD_MAX` (500, matching
  `BULK_DELETE_MAX`) and `parseDeckCardsBody(body)` returning a
  `{ kind: "single"; deckId; cardId }` / `{ kind: "bulk"; deckId; cardIds }`
  union or `{ error }`, modelled on `parseDeleteBody`.
- New `addCardsToDeck(deckId, cardIds)` in `server/utils/decks.ts`: verifies the
  deck once, inserts the rows, and reports back which card ids actually exist.
- `server/api/decks/cards.post.ts` routes both body shapes through the parser,
  returning `{ added, notFound }` for the bulk form and today's unchanged
  response for the single form.
- Ships `server/utils/deckMembership.test.ts` covering the parser: both valid
  shapes, a missing `deckId`, an empty `cardIds`, a non-integer id, and an
  over-limit array. (Logic gate is on, see `coding-standards.md`.)

**Done when:** `bun run test` passes, and `POST /api/decks/cards` with
`{ deckId, cardIds: [a, b] }` puts both cards in the deck, while the same call
repeated returns success and creates no duplicate rows.

### Step 2 - "Add to deck" in the selection bar  (done)

- `app/pages/cards/index.vue`: a deck `<select>` (from the already-loaded
  `manualDecks`) plus an "Add to deck" button in the `checkedIds` selection bar,
  beside Clear selection and Delete.
- `addSelectedToDeck()` sends the checked ids in `chunkIds(ids, 500)` batches,
  then `await refreshMemberships()` so the inspector panel agrees.
- Busy state disables the bar's buttons while in flight; a failure shows its
  message in the existing `.selection-error` slot and leaves the selection
  intact to retry.
- With no manual decks yet, show the same hint `DeckMembershipPanel` uses,
  linking to `/decks?type=created`, instead of an empty dropdown.
- A success shows a brief confirmation naming the deck and the count.

**Done when:** checking several rows on `/cards`, choosing a deck, and clicking
"Add to deck" puts every checked card in that deck, the selection stays checked,
and opening any of those cards in the inspector shows that deck already ticked
in its Decks panel.

## Verify

1. `cd nuxt-app && bun run test` - green, including the new parser test.
2. `bun run dev`, go to `/cards`.
3. Tick 3 rows (use shift-click for a range), pick a deck, click "Add to deck".
   Expect a confirmation naming the deck, and the 3 rows still checked.
4. Click one of those rows: the inspector's Decks panel shows that deck ticked.
5. Go to `/decks?type=created` - the deck's card count went up by 3 and all 3
   are in its card list.
6. Repeat the same add with the same selection: no error, no duplicates.
7. Regression: the header checkbox, shift-click, Delete, and "Delete all N
   matching" all still behave as before.
8. With zero manual decks, the bar shows the create-a-deck hint rather than an
   empty dropdown.
