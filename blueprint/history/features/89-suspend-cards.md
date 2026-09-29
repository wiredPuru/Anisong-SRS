# Feature: Suspend cards

**From build-plan:** feature 89
**Status:** verified

## Goal

Keep a card in the library but out of Study until it is turned back on. This
covers a broken clip, a song not worth drilling, or a duplicate worth keeping.
Unlike feature 87's Bury, it is stored and lasts across sessions. It never
touches the card's schedule or review history.

## In scope

- A `card.suspended` boolean (default false), applying to every grading track
  of the card.
- Suspended cards are never served by Study, never counted in "N left", Home's
  due count, deck tile due counts, or the prefetch lookahead, all through the
  shared `baseDueCondition`.
- `/stats`' review forecast leaves suspended cards out too, so its "due now"
  and its forecast buckets agree.
- `POST /api/cards/suspend` `{ ids, suspended }` for one card or many.
- Study's Edit card panel: a Suspend button beside Bury. Study then moves on.
- `/cards` and deck detail (the shared `CardInspector`): a Suspend / Unsuspend
  action. `CardTable` shows a "Suspended" badge on suspended rows.
- `/cards`: a "Suspended" filter toggle kept in `?suspended=1`, and Suspend /
  Unsuspend on the bulk selection bar.

## Out of scope

- Party mode (feature 86). Its queue builder picks cards by scope and filters,
  not by due state, and a host may deliberately want a suspended card there.
- Collection health, retention, leeches, and every other `/stats` section
  besides the forecast. Suspended cards are still in the library, and their
  history stays.
- Suspending one grading track while leaving another active.
- Auto-suspending leeches.
- Unsuspending from Study. There is no suspended card on screen to act on.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Stored flag, excluded from due** - migration `0026` adds
  `card.suspended` (integer boolean, not null, default false), generated
  through drizzle-kit. `CardWithDetails` gains `suspended: boolean` after
  `notes` (server declaration and `cardSelection`, plus the client copy in
  `useStudySession.ts`, same field order). `baseDueCondition` adds
  `eq(card.suspended, false)`, which covers `dueCardCondition`, Study, Home,
  and deck tiles. `getReviewForecast` adds the same condition to `dueByDate`
  and `backlog`. *Done when:* tests show a suspended due card is not served,
  not counted by `getDueCardCount`, not in `getUpcomingDueCards`, not in the
  forecast's backlog or buckets, and not in an artist deck tile's due count,
  on the title track and on a song track; and that unsuspending brings it back.
  Existing tests and `bun run build` pass.
- [x] **Step 2 - Suspend API and library filter** - `setCardsSuspended(ids,
  suspended)` in `server/utils/cardSuspend.ts` updates in one statement and
  returns `{ updated, notFound }`. `parseSuspendBody` accepts
  `{ ids: number[] (1-500, positive integers, deduped), suspended: boolean }`.
  `POST /api/cards/suspend` returns 400 on a bad body, otherwise the result.
  `cardSearchCondition` gains a `suspendedOnly` flag, and `GET /api/cards` and
  `GET /api/cards/ids` read `suspended=1`. `hasAnyCardsIdsFilter` counts it as
  a filter, so "Delete all N matching" works from the Suspended toggle alone and
  `/api/cards/ids` still refuses to run with no filter. *Done when:* tests
  cover suspend, unsuspend, a mix of real and missing ids, the parser's
  rejects, the library filter alone and combined with text, and
  `hasAnyCardsIdsFilter`.
- [x] **Step 3 - Suspend from Study** - `StudyCardEditPanel` gets a "Suspend"
  button next to "Bury for this session", with a one-line hint under the row
  saying how Bury and Suspend differ (a tooltip was clipped by the form's
  scroll area). It posts to `/api/cards/suspend` and
  emits `suspended` with the card id; on failure it shows its own error line
  like Delete does. `study/index.vue` handles `suspended` like `buried`: it
  closes the panel and calls a new composable `skip(cardId)`, which drops the
  card from `recentCardIds` and fetches the next card. No new hotkey. *Done
  when:* in the running app on a scratch database, Suspend moves Study to
  another card, "N left" drops by one, and the card stays out after a reload.
- [x] **Step 4 - Inspector action and row badge** - `CardInspector` gets a
  Suspend / Unsuspend button beside Delete (no confirm, since it is reversible)
  that posts to `/api/cards/suspend` and emits `updated` with the card's new
  `suspended` value, so `/cards` and deck detail patch their loaded row in
  place. `CardTable` shows a "Suspended" badge in the song cell of a suspended
  row, styled with existing tokens. *Done when:* screenshots in both themes
  show the badge and both button states; toggling updates the row without a
  reload on `/cards` and on a deck's detail view.
- [x] **Step 5 - Filter and bulk actions on /cards** - a "Suspended" toggle
  beside "No AnimeThemes match", kept in `?suspended=1` (read on mount and on
  a same-route navigation, like `missingAnimeThemes`), with its own empty
  state. The selection bar gets "Suspend" and "Unsuspend" buttons that post the
  checked ids in batches of 500 (`chunkIds`), patch the loaded rows, clear the
  selection, and keep failed ids checked with the error shown, the same as bulk
  delete. With the Suspended filter on, unsuspended rows drop out of the list.
  *Done when:* in the running app, bulk Suspend marks the rows, the toggle lists
  exactly the suspended cards, bulk Unsuspend empties that list, and the
  "Delete all N matching" bar appears with only the toggle on.

## Files / areas

- `nuxt-app/server/db/schema.ts`, `nuxt-app/server/db/migrations/0026_*.sql` and `meta/`
- `nuxt-app/server/utils/cards.ts` (`CardWithDetails`, `cardSelection`, `baseDueCondition`, `cardSearchCondition`, `listCards`, `listCardIds`)
- `nuxt-app/server/utils/stats.ts` (`getReviewForecast`)
- `nuxt-app/server/utils/cardSuspend.ts` (new) and its test; `nuxt-app/server/utils/cardDelete.ts` (`hasAnyCardsIdsFilter`)
- `nuxt-app/server/api/cards/suspend.post.ts` (new), `nuxt-app/server/api/cards.get.ts`, `nuxt-app/server/api/cards/ids.get.ts`
- `nuxt-app/app/composables/useStudySession.ts`, `nuxt-app/app/pages/study/index.vue`, `nuxt-app/app/components/study/StudyCardEditPanel.vue`
- `nuxt-app/app/components/card/CardInspector.vue`, `nuxt-app/app/components/card/CardTable.vue`
- `nuxt-app/app/pages/cards/index.vue`

## Data / contracts

- `card.suspended` (boolean, not null, default false). **Load-bearing:** any
  future due-state query must go through `baseDueCondition`, or add this check
  itself.
- `CardWithDetails.suspended: boolean`, after `notes`, in both declarations.
- `POST /api/cards/suspend` `{ ids: number[]; suspended: boolean }` ->
  `{ updated: number; notFound: number[] }`; `400` on a bad body.
- `GET /api/cards` and `GET /api/cards/ids` accept `suspended=1`.

## Testing

Vitest is on:

- Step 1: due exclusion across `getNextDueCard`, `getDueCardCount`,
  `getUpcomingDueCards`, the artist tile due count, and `getReviewForecast`, on
  the title and song tracks (in-memory DB, the `studyBury.test.ts` pattern).
- Step 2: `setCardsSuspended`, `parseSuspendBody`, `cardSearchCondition` with
  `suspendedOnly`, `hasAnyCardsIdsFilter`.

Steps 3-5 are UI and ride on browser evidence (`playwright-cli` against the
built app on a scratch copy of the database, screenshots in both themes) and
`bun run build`.

## Notes for the AI

- Put the exclusion only in `baseDueCondition` (plus the forecast, which builds
  its own queries), not in each caller, so nothing can drift.
- Suspending never writes `box`, `streak`, `nextReviewAt`, `card_track`, or
  `review_log`.
- A suspended card that is in Study's session history can still be opened with
  Previous and the session log, and its review can still be undone (feature 88).
  `prefer` then finds it outside the due pool and serves the normal next card,
  which is correct.
- The Suspend button in Study sits with Bury in the row at the top of the edit
  form (feature 87's as-built note: the form scrolls inside the side panel).
- Copy uses plain hyphens and no em dashes.

## As built

- `cardSearchCondition`, `listCards`, `listCardIds`, and `hasAnyCardsIdsFilter`
  now take one `CardListFilters` object (`missingAnimeThemesMatch`,
  `suspendedOnly`) instead of a growing list of positional booleans, and both
  list routes read it through `parseCardListFilters` (`cardDelete.ts`).
- Study's Suspend button sits between Bury and Delete, with a one-line hint
  under the row explaining how Bury and Suspend differ. A tooltip was tried
  first and was clipped by the edit form's scroll area.
- `CardTable` shows "-" in the Due column for a suspended row instead of a due
  date, since it will not come up. The inspector keeps its Due and Box tiles
  and adds a "Suspended: kept out of Study until you unsuspend it." note.
- `dropDeletedCards` on `/cards` is now `dropCardsFromList`, since it also
  removes rows unsuspended while the Suspended filter is on (from the inspector
  or the bulk bar). The list reloads only in that case, when the dropped rows
  would shift later page offsets.
- The Suspended toggle, like "No AnimeThemes match", reads `?suspended=1` but
  does not write it back to the URL when clicked.
- Browser evidence came from the built app on a scratch copy of the database:
  Suspend in Study took "N left" from 193 to 192 and the card stayed out after
  a reload with its box, streak, and due date unchanged; the inspector toggled
  both ways on `/cards` and on an artist deck's detail view; bulk Suspend of 3
  rows, `?suspended=1` listing exactly those 3 with "Delete all 3 matching",
  and bulk Unsuspend emptying the list to "No suspended cards."
