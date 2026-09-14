# Study a manual deck

**Type:** Fix

**Status:** verified

**Branch:** `fix/study-manual-deck`

**Completed:** 2026-09-14

## The problem

A manual deck's detail view on `/decks` has no "Study this deck" button, so
cards collected into a created deck can only be studied as part of "Study
all". Artist and anime decks show the button; created decks do not.

This is not a rendering bug. Feature 13a hid the button on purpose, because
the study scope never learned about manual decks:

| Layer | Where | Accepts today |
|---|---|---|
| Button | `app/pages/decks/index.vue:835` | `v-if="activeType !== 'created'"` |
| Study page | `app/pages/study/index.vue:8` (`scopeResult`) | `all`, `artist`, `anime` |
| Scope type | `StudyScope` in `server/utils/cards.ts` and `app/composables/useStudySession.ts` | same three |
| Route | `server/api/study/next.get.ts` | same three, 400 otherwise |
| Due query | `dueCardCondition` in `server/utils/cards.ts` | filters by artist or anime id only |

Showing the button alone would link to `/study?type=created&id=N`, which the
study page treats as an invalid scope.

## The fix

Add manual decks as a fourth study scope, `{ type: "created"; id }`, and show
the button for them.

- **`created` as the scope type name.** It is already the manual-deck type
  everywhere else: the `/decks?type=created` tab, `activeType`, and
  `GET /api/decks/cards?type=created`. Using it means the button's existing
  link template and the study page's deck-label fetch (which calls
  `/api/decks/cards` with the scope's type) work without their own changes.
- **Membership filter, not a join.** `dueCardCondition` gains
  `inArray(card.id, <cardIds in deckCard for this deck>)`, so every due query
  that shares it (next card, upcoming prefetch, due count, withheld new count,
  breakdown) picks up manual decks at once, with no change to their join lists.
- **Scope parsing moves into one tested server helper**, `parseStudyScope`,
  since the route is gaining a branch where a wrong answer is possible (a
  `created` id that resolves through `getManualDeckLabel`, not artist/anime).

Out of scope, and left as feature 13a left them:

- Deck export on created decks (the `export-block` at `decks/index.vue:1024`).
- `/stats` slicing by manual deck.

Must not break:

- `all`, `artist`, and `anime` study sessions, including the daily new-card
  limit and "Study new cards".
- The "N cards left" counter and the 2-card prefetch lookahead.
- Artist and anime decks' existing "Study this deck" button.

## Build steps

### Step 1 - manual-deck scope on the server  (done)

- `StudyScope` in `server/utils/cards.ts` gains `{ type: "created"; id: number }`.
- `dueCardCondition` adds the `deckCard` membership filter for that type.
- New `parseStudyScope(type, idRaw)` in `server/utils/studyScope.ts`, returning
  `{ scope }`, `{ status: 400, message }`, or a `created`/`artist`/`anime` id to
  look up. `server/api/study/next.get.ts` uses it and resolves a `created` id
  through `getManualDeckLabel`, answering `404 Deck not found` when missing.
- Ships `server/utils/studyScope.test.ts`: all four types, missing/blank/
  non-numeric id, unknown type. (Logic gate is on.)

**Done when:** `bun run test` passes, and `GET /api/study/next?type=created&id=N`
returns only cards in deck N with a `dueCount` matching that deck's due cards,
while `?type=created&id=999999` answers 404.

### Step 2 - study page and button  (done)

- `StudyScope` in `app/composables/useStudySession.ts` gains the same member.
- `app/pages/study/index.vue`'s `scopeResult` accepts `created`.
- `app/pages/decks/index.vue` shows "Study this deck" for created decks too
  (drop `activeType !== 'created'` from the button's `v-if`, keep `deckLabel`).

**Done when:** on a created deck's detail view the "Study this deck" button
shows, clicking it opens `/study?type=created&id=N`, the scope chip reads the
deck's name, and every card served belongs to that deck.

## Verify

1. `cd nuxt-app && bun run test` - green, including the new scope test.
2. `bun run dev`, open `/decks?type=created` and pick a deck with cards.
3. "Study this deck" is in the header. Click it.
4. The scope chip shows the deck name; the cards-left count equals that deck's
   due cards; pass/fail a few and confirm each card is from the deck.
5. An empty created deck opens a session that reports nothing due, not an error.
6. Regression: "Study all" and an artist deck's "Study this deck" still serve
   their own cards.
