# Fix: Pick the deck from the scope chip on Study and Listen

**Type:** Fix
**Status:** verified

## The problem

The chip at the top left of `/study` and `/listen` (`.chip`, showing "All decks"
or the deck's name) is plain text. Changing deck means leaving for `/decks`,
finding the deck, and clicking Study or Listen again. The user wants the chip to
open a deck picker so the session can be switched in place.

Both pages derive their scope from `?type=&id=`, and both already reset cleanly
when it changes (`useStudySession` and `useListenSession` watch `scope`;
`study/index.vue` also clears its session log, score and result on a scope
change). So switching deck only has to change the URL.

## The fix

A shared `StudyScopePicker.vue` (in `components/study/`, like the other pieces
`/listen` borrows) that replaces the chip on both pages:

- The chip becomes a button with a caret showing the current label. Click opens
  a popover under it; click outside or `Escape` closes it.
- The popover lists **All decks** first, then three tabs matching `/decks` and
  the existing `DeckSourcePicker`: By title, By artist, Created. A search box
  narrows the active tab. Rows show the name and card count, the current deck is
  marked, and like `DeckSourcePicker` it loads the first page (25) from
  `GET /api/decks?type=&q=` and relies on search to narrow further. No new
  server route.
- Picking a row calls `navigateTo({ path: route.path, query: { type, id } })`
  (All decks gives `{ type: "all" }`), so Back returns to the previous deck.
  A `?themes=` param is dropped on a switch; the saved filters still apply.
- It is disabled while a typed round is open or its result is showing on
  `/study` (the same condition that disables Study's theme chips), so a switch
  can never discard an unanswered round.

Must not break: Study's and Listen's existing scope handling, the chip's look when
closed, Study's header layout at narrow widths, and `/decks`' own links.

**Branch note:** the Listen page exists only on `feature/listen-mode`, which is
committed but not yet merged to `master`. Merge it first (`/complete` is waiting
on that), or build this fix on top of that branch.

## Build steps

- [x] **Step 1 - Picker component and helpers** - `app/utils/scopePick.ts` (pure):
  `scopeToQuery(pick)` returning `{ type: "all" }` or `{ type, id }`,
  `isSameScope(scope, pick)`, and `deckRowLabel(type, row)` (anime title in
  English with a Romaji fallback, otherwise `name`). `StudyScopePicker.vue` with
  props `scope`, `label`, `disabled` and an emit `select` carrying the pick;
  latest-request guarding and a 250ms search debounce, as in `DeckSourcePicker`;
  loading, error and no-results states. *Done when:* `scopePick.test.ts` passes
  (the `all` case, each deck type, current-deck matching, and the label
  fallback), and the component renders and filters in the browser when mounted
  on `/listen`.
- [x] **Step 2 - Use it on both pages** - Replace the `.chip` span in
  `study/index.vue` and `listen/index.vue` with the picker, wired to navigate on
  `select`, and disabled on Study while `quizResult` or `submissionBusy`. *Done
  when:* on `/listen` and on `/study`, choosing another deck from the chip loads
  that deck's songs with the chip showing its name; choosing All decks returns to
  everything; Back returns to the previous deck; searching in a tab narrows the
  list; the chip is not clickable mid typed-answer round on Study; and screenshots
  at full width and under 820px show the header unbroken.

## Verify

1. `bun run dev`, open `/listen?type=created&id=<deck>`. Click the top-left chip,
   switch to By title, search for a show, pick it: the playlist reloads for that
   show and the chip names it. Press the browser Back button: the first deck is
   back.
2. Repeat on `/study`. With Typed Answers on and a round open, the chip does not
   open. Study's session log and score reset after a switch, as they do today when
   the URL changes.
3. `bun run test` and `bun run build` pass.

## Testing

`scopePick.ts` is pure logic and ships its Vitest in step 1. The component and the
page wiring are UI and are verified in the browser with screenshots (`bun run
measure`, plus the scripted browser run used for Listen).

## Notes for the AI

- Mirror `DeckSourcePicker.vue` for fetching (`createLatestRequest`, the debounce,
  `extractErrorMessage`); do not refactor it into a shared fetcher in this fix.
- Plain CSS tokens, scoped styles, no inline styles; no em dashes in text.
- Do not touch `StudyThemeChips`, the filters modal, or the deck routes.
