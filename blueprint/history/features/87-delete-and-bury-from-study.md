# Feature: Delete and bury from Study

**From build-plan:** feature 87
**Status:** verified

## Goal

Deal with a card without leaving Study. From the Edit card panel you can delete
a card from the library (for a clip you never want again) or bury it for the
rest of the session (for a card you have just seen elsewhere, or one whose
answer you already know from context). `E` opens and closes the panel so both
are a keypress away.

## In scope

- **Delete** in `StudyCardEditPanel`'s edit form, behind an inline two-step
  confirm whose copy says it deletes from the library, matching feature 61c's
  deck-detail wording. It calls the existing `DELETE /api/cards` `{ id }`, so
  feature 17/61a's local-file and stream-cache cleanup applies unchanged. On
  success Study moves to the next due card. On failure the panel stays open
  with the error and the card is untouched.
- **Bury** in the same edit form: one click, no confirm. It needs none,
  because nothing is stored and it only lasts until the session ends. The card
  is skipped for the rest of this session: no review is recorded, and its box,
  streak, `nextReviewAt`, and `ReviewLog` are untouched.
- **`E` hotkey** toggles the edit form open and closed. The "Edit card" button
  gets a hover tooltip naming `E`, following the hotkeyed-button convention,
  and the hint row under the answer controls gains `E edit card`.
- **Server exclusion**: `GET /api/study/next` takes `bury=<id>,<id>,...`.
  Buried ids are removed from the due pool for the next card, the prefetch
  lookahead, and `dueCount` ("N left").
- **Session history cleanup**: after a delete, that card's entries are removed
  from `sessionHistory`, so Previous card and the session log never open a card
  that no longer exists.

## Out of scope

- A Bury hotkey of its own, and Bury or Delete buttons outside the edit form.
  The approved plan keeps both inside the panel.
- Persisting burials across sessions, or an Anki-style "bury until tomorrow".
- Unburying mid-session. A scope change clears the list, and so does reloading
  the page.
- Delete or Bury from `CardPreviewModal`, `/cards`, or `/decks`, which already
  have their own delete.
- Changing `withheldNewCount`. A buried card is a due card, not one held back by
  the daily new-card cap.
- Escape-to-close for the edit form (not asked for; `E` and Cancel cover it).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server: exclude buried cards** - generalize
  `server/utils/studyRecent.ts`'s parser into `parseCardIdList(raw, param, max)`
  (keeping `parseRecentCardIds` as a thin wrapper, so the fix that added it is
  unchanged). Add `excludedIds` (default `[]`) to `getNextDueCard`,
  `getUpcomingDueCards`, and `getDueCardCount` in `server/utils/cards.ts`,
  applied as a `notInArray(card.id, ...)` added to the due condition, and read
  `bury` in `server/api/study/next.get.ts` (cap `MAX_BURIED_CARD_IDS` = 500,
  `400` on malformed input). *Done when:* `bun run test` passes with the new
  cases, and against the dev server
  `GET /api/study/next?type=all&bury=<served id>` serves a different card with
  `dueCount` exactly one lower, while `bury=abc` returns `400`.
- [x] **Step 2 - Client session: bury and forget** - `useStudySession` gains
  `buriedCardIds` (session-only, cleared on scope change, kept on filter
  change), sends it as `bury=` when non-empty, and exposes
  `bury(cardId)` (adds the id, then `fetchNext()`) and
  `removeDeleted(cardId)` (drops the id from the recent and buried lists, then
  `fetchNext()`). A pure helper for adding to the id list gets a test. *Done
  when:* the helper test passes, and calling `bury` from the browser console on
  `/study` issues a `next` request carrying `bury=<id>`.
- [x] **Step 3 - Edit panel: Delete and Bury** - `StudyCardEditPanel` gets
  Delete (with an inline Confirm/Cancel, `deleting` state, and an error line)
  and "Bury for this session" in its edit form, emitting `deleted` and
  `buried`. `study/index.vue` handles `deleted` by filtering the card out of
  `sessionHistory` and calling `removeDeleted`, and `buried` by calling `bury`.
  *Done when:* in the browser, with `DELETE /api/cards` mocked, Confirm serves
  a new card and the deleted one is gone from the session log; Bury serves a
  new card, "N left" drops by one, and `review_log`'s latest id is unchanged.
- [x] **Step 4 - `E` hotkey** - `StudyCardEditPanel` exposes `toggle()` via
  `defineExpose`, which calls `startEdit`/`cancelEdit` and respects
  `disabled`. `study/index.vue` binds `e` in `onKeydown` to it, alongside the
  other hotkeys. It is ignored in text fields (the existing `isTypingTarget`
  guard), while the typed-answer result is showing, while loading or
  submitting, and while Previous card, the session log, or Filters is open.
  Add the tooltip and hint. *Done when:* in the browser, `E` opens and closes
  the form. Typing `e` into the notes box or the typed-answer box does not
  toggle it, and `E` does nothing while the session log is open.

## Files / areas

- `nuxt-app/server/utils/studyRecent.ts` (+ test) - shared id-list parser.
- `nuxt-app/server/utils/cards.ts` (+ `studyDueFilters.test.ts` or a new
  DB-backed test) - `excludedIds` on the three due queries.
- `nuxt-app/server/api/study/next.get.ts` - the `bury` param.
- `nuxt-app/app/utils/recentCards.ts` (+ test) - list helper for buried ids.
- `nuxt-app/app/composables/useStudySession.ts` - `buriedCardIds`, `bury`,
  `removeDeleted`.
- `nuxt-app/app/components/study/StudyCardEditPanel.vue` - Delete, Bury,
  `toggle()`, tooltip.
- `nuxt-app/app/pages/study/index.vue` - event handlers, `E` binding, hint.

## Data / contracts

- **No schema change and no migration.**
- `GET /api/study/next` gains an optional `bury` query param: comma-separated
  positive card ids, at most 500. Absent or empty means none. Anything else
  returns `400`. Buried ids are excluded outright. That differs from the
  existing `recent` param, which only puts cards at the back of the queue.
- `StudyCardEditPanel` gains emits `deleted: [cardId: number]` and
  `buried: [cardId: number]`, plus an exposed `toggle(): void`.
- `DELETE /api/cards` is used as-is (`{ id }` form).

## Testing

`bun run test` is configured, so each logic step ships a test:

- **Step 1:** `parseCardIdList` covers absent, empty, valid, duplicates,
  malformed, zero or negative, and over the cap, and `parseRecentCardIds`'
  existing cases stay green. A DB-backed test (the in-memory pattern
  `studyDueFilters.test.ts` uses) shows `excludedIds` removes a card from
  `getNextDueCard`, `getUpcomingDueCards`, and `getDueCardCount`, and that
  excluding every due card returns `undefined` and `0`.
- **Step 2:** a list-helper test (add, no duplicate, and no window cap for
  burials).
- **Steps 3 and 4:** UI, so they rely on browser evidence plus `bun run build`.
  Browser runs must mock `POST /api/study/review` and `DELETE /api/cards`,
  and confirm `review_log`'s latest id and the card count are unchanged before
  and after, so verification never deletes or grades a real card.

## Notes for the AI

- Server routes own the DB; the page and panel only call routes
  (`coding-standards.md`).
- Keep `recent` (the spacing fix) and `bury` separate: `recent` reorders and
  may still serve a recent card, while `bury` never serves a buried card.
- Deleting the current card must not submit a review. Reset any open typed
  round the same way loading a new card already does (`presentationKey`
  changes when `fetchNext` serves a card).
- When every remaining due card is buried or deleted, `fetchNext` returns no
  card and the existing "All caught up" state shows. No new empty state is
  needed.
- Hint and tooltip copy use plain hyphens and no em dashes (`Writing` in
  `coding-standards.md`).

## As built

- Bury and Delete sit in a row at the **top** of the edit form, not beside
  Save/Cancel: the form scrolls inside the side panel, so at the bottom they
  were off screen after `E` opened it. A failed delete shows its own error line
  right under that row, and the confirm scrolls itself into view.
- Step 2's "call `bury` from the browser console" check was not possible (the
  composable is not reachable from the console). Its proof moved to step 3's
  browser run, where the Bury button sent `bury=529`.
