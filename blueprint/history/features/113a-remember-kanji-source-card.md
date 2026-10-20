# Feature: Remember the source card of a kanji (113a)

**From build-plan:** feature 113a (first sub-feature of 113, "Kanji plays its source song")
**Status:** verified (bun run test 2570 passed, bun run build passed, API smoke test on a temporary data directory; the Study/Listen click-through against a real card was not run)

## Goal

A kanji added to Kanji Study remembers which card it was added from. Today
`kanji_card` holds only the character and its schedule, so `/kanji` has no way
to know which song to play and falls back to random clips (feature 111c).
113a stores that link and nothing else; 113b makes `/kanji` use it. The app
looks and behaves exactly as before.

## In scope

- Nullable `kanji_card.sourceCardId` (FK to `card.id`, set null on card delete)
  and its Drizzle migration.
- `POST /api/kanji/cards` accepts an optional `sourceCardId`.
- The breakdown's "Add to Kanji Study" button sends the card on screen, from
  both Study and Listen, for tiles, part chips and the drill-in detail view
  (a part added by drilling in uses the same card).
- First source wins: only a newly inserted row gets a source.

## Out of scope

- Playing the source clip on `/kanji` (113b).
- Backfilling kanji added before this (they stay null and play random clips).
- Changing a kanji's source after it is added (remove and re-add does it).
- Exposing the field in the client's `NextReply` type (113b reads it).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Column and migration** - add `sourceCardId` to `kanjiCard` in `server/db/schema.ts` (`integer("source_card_id").references(() => card.id, { onDelete: "set null" })`), then generate the migration with Drizzle (never hand-written `ALTER TABLE`). *Done when:* the generated `0042_*.sql` adds only that column, the app boots and migrates an existing database, and deleting a card that a `kanji_card` row points at leaves the row with a null source.
- [x] **Step 2 - Server accepts and stores it** - `parseKanjiAddBody` returns `sourceCardId` (optional; a non-positive-integer value is a 400); `addKanjiCards(chars, sourceCardId?)` stores it only on newly inserted rows, and stores null when that card does not exist. Route passes it through. *Done when:* the unit tests below pass and `POST /api/kanji/cards` with and without the field both return `{ added, alreadyAdded }` as before.
- [x] **Step 3 - Send it from the breakdown** - `useKanjiDeck().add(char, sourceCardId?)` posts it; `StudyKanjiDeckButton` takes an optional `sourceCardId` prop; `StudyJapaneseBreakdown` and `StudyKanjiDetail` take and forward it; Study and Listen pass `currentCard.id`. *Done when:* in the running app, adding a kanji from a card on Study, from a part chip, and from Listen each stores that card's id (checked in the `kanji_card` table or `GET /api/kanji/cards`), re-adding after remove replaces it, and Add/Added/Remove behaviour looks unchanged.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `nuxt-app/server/db/migrations/0042_*.sql` and its `meta` snapshot (generated)
- `nuxt-app/server/utils/kanjiCards.ts` (+ `kanjiCards.test.ts`), `nuxt-app/server/api/kanji/cards/index.post.ts`
- `nuxt-app/app/composables/useKanjiDeck.ts`
- `nuxt-app/app/components/study/StudyKanjiDeckButton.vue`, `StudyJapaneseBreakdown.vue`, `StudyKanjiDetail.vue`
- `nuxt-app/app/pages/study/index.vue`, `nuxt-app/app/pages/listen/index.vue` (one prop each)

## Data / contracts

Load-bearing for 113b:

- `kanji_card.source_card_id` - nullable integer, FK `card.id`, `ON DELETE SET NULL`. Null means "play random clips".
- `POST /api/kanji/cards` body: `{ chars: string[], sourceCardId?: number }`. Reply unchanged.
- `KanjiStudyItem` (server) gains `sourceCardId: number | null` through the row spread; `GET /api/kanji/cards` and `/next` therefore return it.
- A `sourceCardId` for a card that does not exist is stored as null rather than failing the add (foreign keys are on).

## Testing

Vitest is configured, so the logic gate is on. In `kanjiCards.test.ts` (in-memory DB, already set up there):

- `parseKanjiAddBody`: accepts a missing `sourceCardId`; accepts a positive integer; rejects `0`, negatives, fractions, strings.
- `addKanjiCards`: stores the source on a new row; first source wins (a second add of an existing char with another card changes nothing); an unknown card id stores null; no source stores null.
- Deleting the source card nulls the column (needs a card row; seed song/anime/artist as other server tests do).

Components and pages ride on `bun run build` plus a browser check of Step 3's done-when. Run `bun run test` before approving each step.

## Notes for the AI

- No em dashes, minimal comments (why only), `<script setup lang="ts">`, scoped CSS with tokens.
- The client keeps its own copy of server shapes by hand; do not add the field to client types until 113b needs it.
- Use `bun run` commands from `nuxt-app/`; generate the migration with the project's Drizzle script, do not edit SQL by hand.
- Do not touch the clip logic in `useBackgroundClips.ts`; that is 113b.
