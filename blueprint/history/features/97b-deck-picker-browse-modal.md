# Deck picker in the browse modal (97b)

**Type:** Feature (build-plan item 97, sub-feature 97b of 97a-97b)
**Status:** verified

## Goal

"Browse by filters" can put the imported cards straight into a manual deck: an
existing one, or a new one by name.

## Scope change from the plan

The plan also named `StudyFilterForm`'s "Import the rest". That one needs no
picker: it lives inside `DeckFilterCardsModal`, which already has a target deck
(or creates one), and the shows it imports arrive ticked there and are added to
that deck by the modal's own Add. So 97b covers the browse modal only.

## In scope

- `DeckTargetPicker.vue`: a select with "No deck", each manual deck, and "New
  deck..." (which shows a name field). Defaults to No deck.
- `app/utils/deckTarget.ts` (pure): the `DeckTarget` shape, `deckTargetProblem`
  (a new deck needs a trimmed, non-empty name), and `resolveDeckTarget`, which
  creates a new deck once and returns the id to pass as `deckId`.
- `CardBrowseModal` creates the deck before the first import, passes `deckId` on
  every `import-cards` call, and switches the picker to the created deck so a
  retry or a second run never creates it again. A failed create stops the run
  with the error shown. The summary adds how many cards joined the deck.

## Out of scope

Artist and anime decks; a deck picker in "Import the rest"; paging past the
first page of decks in the picker.

## Build steps

- [x] 1. **Deck target logic.** `app/utils/deckTarget.ts` plus tests, and
  `importAnimeBatch` totalling `addedToDeck` from each result.
  **Done when:** tests cover no deck, an existing deck, a new deck created once
  across two resolves, a blank name rejected, a failed create surfacing its
  error, and the batch summing `addedToDeck`.
- [x] 2. **Picker + modal wiring.** `DeckTargetPicker.vue` and its use in
  `CardBrowseModal`, including the summary line.
  **Done when:** `bun run build` passes and the modal shows the picker, with
  "New deck..." revealing a name field and Add disabled while that name is blank.

## Files and areas

`app/utils/deckTarget.ts`, `app/utils/importAnimeBatch.ts`,
`app/components/deck/DeckTargetPicker.vue`, `app/components/card/CardBrowseModal.vue`
(+ tests).

## Testing

Logic (target resolve, batch totals) gets Vitest tests; the picker and modal
ride on the build. No live write tests against the dev server: it writes to the
real database.
