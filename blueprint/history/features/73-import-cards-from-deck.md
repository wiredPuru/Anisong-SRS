# Feature: Import cards from another deck

**From build-plan:** feature 73
**Status:** verified

## Goal

Fill a manual deck quickly by copying every card from one or more existing
decks (artist, anime, or another manual deck) in one action. Today a manual
deck is filled one card at a time (feature 28's search box, feature 33's
AniList add) or by hand-selecting rows on `/cards` (the `bulk-add-cards-to-deck`
fix).

## In scope

- A server route that copies every card of the given source decks into one
  manual deck, resolved on the server with no per-request card cap.
- A shared source-deck picker: By title / By artist / Created tabs, a search
  box, and removable chips for the chosen decks, each showing its card count.
- Entry point 1, **create**: the "+ New deck" form on `/decks`' Created tab
  gets an "Import cards..." button. It opens a modal holding the typed name
  and the picker. Confirming creates the deck, then copies the cards.
- Entry point 2, **existing deck**: an "Import from deck" button in a manual
  deck's detail view (the "Add cards" block) opens the same modal without the
  name field.
- A result line after the copy, for example: "Added 42 cards (5 already in
  deck)".

## Out of scope

- Live-linked decks that follow later changes to their source (this is a
  one-time snapshot).
- Copying scheduling state. `CardTrack` is keyed by `(card, criterion)`, not
  by deck, so there is nothing per-deck to copy.
- Picking individual cards out of a source deck. That is what `/cards`'
  selection bar is for.
- Import into artist or anime decks. They are derived, with no rows to write.
- Deck export/import (feature 9, `/api/decks/import`), which is a different
  feature. The new route is named `copy-cards` so the two can't be confused.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Body parser + tests** - `parseCopyCardsBody(body)` in
  `server/utils/deckMembership.ts`, beside `parseDeckCardsBody`. It validates
  `deckId` (a positive integer) and `sources` (a non-empty array of at most
  `COPY_SOURCES_MAX` = 50 `{ type, id }` items, where `type` is `artist`,
  `anime` or `created` and `id` is a positive integer). It dedupes repeated
  sources and rejects a `created` source whose id equals `deckId`.
  *Done when:* `bun run test` passes with new cases for valid, deduped,
  empty, oversized, bad-type, bad-id and self-source bodies.
- [x] **Step 2 - Copy util + route** - `copyCardsFromDecks(deckId, sources)`
  in `server/utils/decks.ts`. It returns `{ notFound: true }` when the target
  deck doesn't exist. Otherwise, in one transaction, it counts target members
  before and after an `INSERT ... SELECT DISTINCT ... ON CONFLICT DO NOTHING`
  per source. Artist and anime sources join `card -> song`; created sources
  read `deck_card`. Using `INSERT ... SELECT` avoids SQLite's bound-variable
  limit. It returns `{ added, alreadyInDeck, missingSources }`, where
  `missingSources` lists sources whose artist, anime or deck row doesn't
  exist. `POST /api/decks/copy-cards` wraps it: `400` for a bad body, `404`
  for a missing target. *Done when:* a `curl` against the dev server copies an
  artist deck into a test manual deck and reports the right `added`. A second
  identical call reports `added: 0` with all cards under `alreadyInDeck`. A
  missing target returns `404`, and a self-source returns `400`.
- [x] **Step 3 - Source picker + modal on an existing deck** -
  `components/deck/DeckSourcePicker.vue` has tabs (`tab-seg`), a debounced
  search over `GET /api/decks?type=&q=` (first page only), result rows showing
  name and card count, and chips for the chosen decks. The current target
  deck is excluded. `components/deck/DeckCopyCardsModal.vue` wraps the picker
  with Confirm and Cancel, calls `copy-cards`, and shows the result or the
  error inline. It is wired to an "Import from deck" button in the manual
  deck detail view's "Add cards" block. On success the detail card list
  reloads fresh (same as the add-new-anime flow) and the tile's card count
  updates. *Done when:* a browser run imports an anime deck and an artist
  deck into an existing manual deck, the detail list and count show the new
  cards, and a failed request shows an inline error with the modal still
  open.
- [x] **Step 4 - Create-with-import entry point** - an "Import cards..."
  button on the "+ New deck" form opens `DeckCopyCardsModal` in create mode,
  with a name field prefilled from the form. Confirm calls `POST /api/decks`
  and then `copy-cards`. A name error (blank or duplicate) keeps the modal
  open with the message. If the copy fails after the deck was created, the
  deck is kept (not rolled back): the modal says "Deck created, but importing
  cards failed" and closing it shows the new tile. The plain Create button is
  unchanged. *Done when:* a browser run creates a deck from two sources and
  its tile shows the combined distinct count. A duplicate name is refused
  inside the modal, and plain Create still works with no import.

## Files / areas

- `nuxt-app/server/utils/deckMembership.ts` (+ `.test.ts`) - parser
- `nuxt-app/server/utils/decks.ts` - `copyCardsFromDecks`
- `nuxt-app/server/api/decks/copy-cards.post.ts` - new route (server)
- `nuxt-app/app/components/deck/DeckSourcePicker.vue` - new (client)
- `nuxt-app/app/components/deck/DeckCopyCardsModal.vue` - new (client)
- `nuxt-app/app/pages/decks/index.vue` - two entry points, refresh after copy

## Data / contracts

No schema change or migration: this only inserts `deck_card` rows.

```ts
type DeckSource = { type: "artist" | "anime" | "created"; id: number };

// POST /api/decks/copy-cards
interface CopyCardsBody { deckId: number; sources: DeckSource[] } // 1-50 sources
interface CopyCardsResult {
  added: number;          // new DeckCard rows
  alreadyInDeck: number;  // distinct source cards that were already members
  missingSources: DeckSource[];
}
```

`DeckSource` deliberately uses the same `type` names as `StudyScope`
(`artist` / `anime` / `created`). `DeckRef` is left unchanged, since deck
export still depends on it covering only artist and anime.

## Testing

- **Unit (gate on):** `parseCopyCardsBody` in step 1. The copy util runs
  against the real DB, so it rides on step 2's `curl` evidence, the same way
  `addCardsToDeck` does today.
- **Browser:** steps 3 and 4 are verified with `playwright-cli` on `/decks`,
  with screenshots of the modal, the result line, and the updated tile or
  detail list.
- `bun run test` and `bun run build` are green before each step is approved.

## Notes for the AI

- The overlap between two sources is counted once: `alreadyInDeck` counts
  distinct source cards, not source-card pairs. Compute it as
  `distinctSourceCards - added`, where `distinctSourceCards` comes from a
  `COUNT(DISTINCT)` over the union.
- `themesOnly` does not filter the copy. Membership is independent of it, the
  same as `addCardsToDeck`.
- Keep the modal's z-index on the existing modal tokens and its backdrop on
  `--scrim` (feature 62b). No hard-coded colors, no inline styles.
- A list row whose only control is one button fires on a row click
  (`.row-clickable`, per the `click-single-action-rows` fix). Picker result
  rows qualify.
- After a copy, reload the detail list fresh rather than patching it in
  place. Imported cards can land anywhere in the `createdAt desc` order
  (feature 35c's convention for add flows).
- No em dashes in code comments or UI copy.
