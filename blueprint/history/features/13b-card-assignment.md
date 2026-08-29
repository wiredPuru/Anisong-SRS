# Feature: Card assignment

**From build-plan:** feature 13b
**Status:** verified

## Goal

Let a card be added to or removed from any number of manual decks - this is
what actually populates the decks 13a lets you create. Once assigned, the
`/decks` Created view shows real card counts and real card lists instead of
always-empty ones.

## In scope

- `deck_card` join table: `id`, `deckId` (FK -> Deck, cascades), `cardId`
  (FK -> Card, cascades), unique on `(deckId, cardId)`. One small deviation
  from `project-overview.md`'s earlier-sketched shape: it now has its own
  `id` PK alongside the composite unique, matching every other table in this
  schema (including `song`'s identical PK-plus-unique pattern) rather than
  relying on the composite as the primary key.
- `GET /api/decks/memberships` - every card's manual-deck membership in one
  query (`{ memberships: Record<cardId, deckId[]> }`), so `/cards` can render
  every row's checkbox state from one fetch instead of one query per row.
- `POST /api/decks/cards` (`{ deckId, cardId }`) - add a card to a deck;
  idempotent (adding an already-assigned card is a no-op success, not an
  error - this is a checkbox toggle, not a form submit). 404 if the deck or
  card doesn't exist.
- `DELETE /api/decks/cards` (`{ deckId, cardId }`) - remove a card from a
  deck; idempotent the same way. 404 only if the deck doesn't exist
  (removing a card that was never in it is a no-op, not an error).
- `listManualDecks()` and `GET /api/decks/cards?type=created&id=<id>` become
  real: `ManualDeck` gains a real `cardCount` (left-joined - a deck with zero
  cards must still appear, unlike Artist/Anime decks which are inner-joined
  *from* having at least one card), and the detail endpoint returns actual
  assigned cards instead of always `[]`.
- **`/cards` UI**: a "Decks" control per row opening a small panel listing
  every manual deck as a checkbox (checked = currently assigned), toggling
  one calls add/remove immediately - no separate save step. With zero manual
  decks, the panel shows a hint linking to `/decks?type=created` instead of
  an empty list.
- **`/decks` UI**: the Created list's card counts become real; a manual
  deck's detail view shows its actual cards (reusing the existing card-row
  markup already built for Artist/Anime decks) with a **Remove** button per
  card, so membership can be managed from either page.

## Out of scope

- `/cards/new` - same call as feature 11 made for its Preview button on this
  exact page: the add-to-deck action lives on `/cards` only, not
  immediately after creating a card. Consistent, not a new precedent.
- Deck-scoped study and deck-scoped export for manual decks - both remain
  deferred from 13a. `StudyScope` still has no `"created"` variant, and
  export still only supports artist/anime scope; neither is extended here.
- Bulk assignment (e.g. "add all cards by this artist to a deck") - one
  card, one deck, one checkbox at a time.
- Reordering cards within a deck - decks are unordered sets, matching how
  Artist/Anime decks already have no defined card order beyond
  `desc(createdAt)`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema + membership API** - add `deckCard` to
  `server/db/schema.ts` (Drizzle migration via `bun run db:generate`). In
  `server/utils/decks.ts`: `getDeckMembershipsByCard()` (one query, grouped
  in JS into `Record<number, number[]>`), `addCardToDeck(deckId, cardId)`
  and `removeCardFromDeck(deckId, cardId)` (both return
  `{ notFound: true } | { success: true }`; add checks both rows exist
  first since an FK violation would otherwise surface as a raw DB error;
  remove only checks the deck exists), and update `listManualDecks()` to
  left-join `deckCard` for a real `cardCount`. In `server/utils/cards.ts`:
  `listCardsByManualDeck(deckId)`, reusing the existing `cardQuery()`
  builder plus an extra join on `deckCard`, mirroring
  `listCardsByArtist`/`listCardsByAnime`. Add
  `server/api/decks/memberships.get.ts`,
  `server/api/decks/cards.post.ts`, `server/api/decks/cards.delete.ts`
  (mirroring existing route conventions), and change
  `server/api/decks/cards.get.ts`'s `type === "created"` branch to call
  `listCardsByManualDeck` instead of returning `[]`. *Done when:* `curl`
  round-trip - create two decks, `POST /api/decks/cards` adds a real card
  to both, `GET /api/decks/memberships` shows both deck ids for that card,
  `GET /api/decks?type=created` shows `cardCount: 1` on each, `GET
  /api/decks/cards?type=created&id=<id>` returns the real card; adding the
  same card again is a `200` no-op (no duplicate row - confirmed via
  `cardCount` staying `1`); `DELETE` removes it and both `cardCount` and
  `memberships` reflect that; removing an already-absent membership is a
  `200` no-op; adding to/from an unknown deck or card id `404`s; deleting
  the *deck* (via 13a's existing `DELETE /api/decks`) or the *card* (via
  the existing `DELETE /api/cards`) while a membership exists cleans up the
  `deck_card` row automatically (foreign keys are already `PRAGMA`-enabled
  in `db/client.ts`) - confirmed via `GET /api/decks/memberships` no longer
  listing it.
- [x] **Step 2 - `/cards` assignment UI** - in `app/pages/cards/index.vue`,
  fetch `/api/decks?type=created` and `/api/decks/memberships` alongside
  the existing `/api/cards` fetch. Add a "Decks" toggle button per row
  opening an inline panel: a checkbox per manual deck
  (`:checked="memberships[c.id]?.includes(d.id)"`), each `@change` calling
  `POST`/`DELETE /api/decks/cards` immediately and then re-fetching
  memberships (in a `finally`, so a failed request still reconciles the
  checkbox back to server truth instead of trusting the browser's own
  toggle). With zero manual decks, the panel shows "No manual decks yet -
  create one on the Decks page." with a `NuxtLink` to `/decks?type=created`
  instead of an empty checkbox list. *Done when:* in the browser, opening a
  card's Decks panel shows checkboxes matching its real membership;
  checking one adds it (confirmed via `curl
  /api/decks/memberships` afterward); unchecking removes it; a card with no
  manual decks configured shows the hint and link instead.
- [x] **Step 3 - `/decks` real counts and card list** - in
  `app/pages/decks/index.vue`, change the `"created"` branch of `deckItems`
  from a hardcoded `cardCount: 0` to the real `d.cardCount` now returned by
  the API. In the manual-deck detail view, add a **Remove** button
  (`v-if="activeType === 'created'"`) to each card row, calling `DELETE
  /api/decks/cards` with the current `selectedId` and that card's id, then
  re-fetching the deck detail. *Done when:* in the browser, the Created
  list shows accurate card counts for decks populated in Step 2; opening
  one of those decks shows its real cards (song title, artist, anime,
  source badges - identical row styling to Artist/Anime decks); clicking
  Remove on a card takes it out of the list and the count updates; Artist
  and Anime detail views show no Remove button, unchanged from before this
  feature.

## Files / areas

- `nuxt-app/server/db/schema.ts` - add `deckCard`; new migration.
- `nuxt-app/server/utils/decks.ts` - membership functions; real `cardCount`
  on `listManualDecks`.
- `nuxt-app/server/utils/cards.ts` - `listCardsByManualDeck`.
- `nuxt-app/server/api/decks/cards.get.ts` - `created` branch returns real
  cards.
- `nuxt-app/server/api/decks/cards.post.ts` - new (add).
- `nuxt-app/server/api/decks/cards.delete.ts` - new (remove).
- `nuxt-app/server/api/decks/memberships.get.ts` - new.
- `nuxt-app/app/pages/cards/index.vue` - Decks panel per row.
- `nuxt-app/app/pages/decks/index.vue` - real `cardCount`, Remove button.

## Data / contracts

```ts
// server/db/schema.ts
export const deckCard = sqliteTable(
  "deck_card",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deckId: integer("deck_id").notNull().references(() => deck.id, { onDelete: "cascade" }),
    cardId: integer("card_id").notNull().references(() => card.id, { onDelete: "cascade" }),
  },
  (table) => [unique("deck_card_unique").on(table.deckId, table.cardId)],
);
```

```ts
// server/utils/decks.ts
export interface ManualDeck {
  id: number;
  name: string;
  createdAt: Date;
  cardCount: number; // now real (left-joined), was hardcoded 0 client-side in 13a
}
```

`GET /api/decks/memberships` -> `{ memberships: Record<number, number[]> }`
(`cardId` -> array of `deckId`).

`POST /api/decks/cards` / `DELETE /api/decks/cards` request/response:

```ts
interface DeckCardMembershipRequest {
  deckId: number;
  cardId: number;
}
// success: { success: true }
// failure: 404 "Deck not found" | "Deck or card not found"
```

`GET /api/decks/cards?type=created&id=<id>` -> `{ deckLabel: string, cards: CardWithDetails[] }`
(same envelope as artist/anime, now genuinely populated).

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test` entry),
so this rides on direct verification, same as recent features:

- Step 1: `curl` round-trip covering add/remove idempotency, 404s, the real
  `cardCount`/membership data, and both cascade-delete paths (deck deleted,
  card deleted). `bun run build` must stay clean.
- Steps 2 & 3: browser check of the full assign/unassign flow from both
  `/cards` and `/decks`, confirming Artist/Anime views are unaffected.

`getDeckMembershipsByCard`'s grouping and the add/remove idempotency logic
are pure-ish, clear-right-or-wrong-answer candidates for a future test if
`/tests` adds a runner.

## Notes for the AI

- Server-only: all new DB access stays in `server/utils/decks.ts`,
  `server/utils/cards.ts`, and the three route files; pages only call
  `$fetch`/`useFetch`, per `coding-standards.md`.
- Reuse, don't fork: `listCardsByManualDeck` must go through the same
  `cardQuery()`/`cardSelection` in `cards.ts` that every other card-listing
  function already uses - not a hand-rolled duplicate query.
- Match existing error-response conventions (`createError`,
  `extractErrorMessage`) and the query-string convention (`?type=&id=`) -
  no dynamic route segments.
- `foreign_keys = ON` is already set in `server/db/client.ts` (used by
  `reviewLog`'s existing cascade) - `deckCard`'s cascades need no extra
  wiring, just the `references(..., { onDelete: "cascade" })` declarations
  themselves.
