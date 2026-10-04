# Deck target on the import route (97a)

**Type:** Feature (build-plan item 97, sub-feature 97a of 97a-97b)
**Status:** verified

## Goal

`POST /api/lookup/import-cards` can add the imported show's cards straight to a
manual deck, so bulk imports (94, 96) can fill a deck as they go. No UI, so the
app behaves as it does today.

## In scope

- Optional `deckId` in the body. It is validated before any import work, so a
  missing deck is a 404 and nothing is imported.
- `addCardsForThemes` also reports `cardIds`: every card for the show's themes
  after the run, whether just created or already present.
- The route links those cards to the deck and returns `addedToDeck` and
  `alreadyInDeck` beside the existing counts.

## Out of scope

- Any UI, creating the deck (the client does that, as "New deck from filters"
  does), and artist or anime decks (derived, not stored).

## Decisions

- **Existing cards join too**, not only newly created ones.
- **Idempotent**: a card already in the deck counts as `alreadyInDeck`.
- **Nothing is rolled back** if a later show fails; each call is independent.
- A card skipped for a clip block or themes-only gate has no id, so it is not
  linked.

## Build steps

- [x] 1. **Logic + route.** `cardIds` from `addCardsForThemes`
  (`server/utils/animeImport.ts`), `linkCardsToDeck(deckId, cardIds)` in
  `server/utils/decks.ts` returning `{ addedToDeck, alreadyInDeck }`, the
  `deckId` parse and 404 in `import-cards.post.ts`. Tests for each.
  **Done when:** `bun run test` passes cases for created plus existing ids,
  skipped themes absent, a card already in the deck counted as `alreadyInDeck`,
  and an unknown or invalid `deckId`; and a `curl` against the dev server with a
  real `deckId` returns the new counts and the deck then lists the cards.

## Files and areas

`server/utils/animeImport.ts`, `server/utils/decks.ts`,
`server/api/lookup/import-cards.post.ts` (+ tests).

## Contracts (load-bearing for 97b)

```ts
// POST /api/lookup/import-cards  body: { aniListId: number; deckId?: number }
// -> { aniListId, title, added, alreadyAdded, skipped,
//      addedToDeck?: number, alreadyInDeck?: number }   // present only with deckId
```

## Testing

All logic gets Vitest tests (in-memory DB like `animeImport.test.ts`); the route
is thin and gets a `curl` check.

## Notes for the AI

Update `project-overview.md`'s item 97 entry and check off 97a at `/complete`.
