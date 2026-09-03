# Feature: Previous card navigation in Study

**From build-plan:** feature 51
**Status:** verified

## Goal

Let a user on `/study` step back and review the card they were just shown,
without leaving the session or disturbing the live Leitner queue. Today the
session is strictly forward-only: once you pass/fail a card, `useStudySession`
fetches the next due card and the one you just answered is gone until the
Leitner schedule brings it back around.

## In scope

- A `sessionHistory` list, built client-side in `study/index.vue`, of every
  card actually reviewed so far this session, in order, each entry carrying
  its pass/fail result. This is the load-bearing data contract feature 52
  (the study session log) will read directly - see Data / contracts.
- A "Previous" action (button + `P` hotkey) that shows the single most
  recently reviewed card - `sessionHistory`'s last entry - in the existing
  `CardPreviewModal` (feature 11/16/36): full playback, info panel, language
  toggles, and its own edit mode, exactly as Preview already works from
  `/cards`/`/decks`. Available in both immersive and non-immersive layouts,
  next to the existing Pass/Fail controls.
- Disabled (button) / no-op (hotkey) when there's nothing to go back to yet
  (start of session, before the first card is answered).
- Pausing the live `StudyMediaPlayer` before opening the modal, so its audio
  can never overlap with Preview's - this is the same failure class that got
  features 18/32 abandoned, so it's handled explicitly rather than assumed
  away.
- `sessionHistory` resets whenever the study scope changes (switching deck),
  matching "this session" semantics.
- Editing the previous card from inside the Preview modal (its existing local
  path / metadata edit mode) patches that same `sessionHistory` entry, so
  reopening "Previous" without leaving the page shows the edit.

## Out of scope

- **Multi-step history browsing.** "Previous" always shows the single most
  recent past card, not an arbitrary earlier one and not a way to page
  further back from inside the modal. Browsing the full list is feature 52's
  job, which this feature's `sessionHistory` is built to hand off to
  directly.
- **Re-submitting a review from the historical view.** `CardPreviewModal` has
  no pass/fail controls (Preview never has), so this falls out naturally -
  viewing a previous card never changes its Leitner box/interval or writes a
  new `ReviewLog` row.
- **Persisting history across a reload.** In-memory only, like Hide
  Video/Hide Info/Random Start/Ambient mode already are - resets on
  navigation away or reload.
- **A "Next" action to move forward through history.** Not needed: forward
  motion already exists (closing the modal returns to the live, current
  card; answering the live card advances the queue as today).

## Build steps

- [x] **Step 1 - Previous card navigation** - implements the full feature in
  one reviewable step (the pieces are small and only meaningful together: a
  button with nothing to show, or history tracking with no way to view it,
  aren't independently useful).

  - `StudyMediaPlayer.vue`: added `defineExpose({ pause: () => activeEl.value?.pause() })`
    right after `togglePlay()`, so the parent can stop live playback without
    reaching into its internals.
  - `study/index.vue`:
    - A `SessionHistoryEntry { card: CardWithDetails; result: "pass" | "fail" }`
      type and a `sessionHistory = ref<SessionHistoryEntry[]>([])`.
    - Replaced `@pass="submit('pass')"` / `@fail="submit('fail')"` on both
      `<StudyAnswerControls>` instances with a new `submitReview(result)`
      wrapper that compares `reviewedCount` before/after `submit()` -
      deliberately not `presentationKey`, which does not bump once the queue
      runs out - so only a genuinely successful review is pushed to history.
    - `watch(scope, () => { sessionHistory.value = []; })` alongside the
      page's other scope-reactive state.
    - A `mediaPlayerRef` template ref bound to `<StudyMediaPlayer>`,
      `openPreviousCard()` (pauses the live player, opens the modal), and
      `onPreviousCardUpdated()` (patches the history entry, and also the
      live `currentCard` when a failed card resurfaced immediately as the
      same id).
    - `P`/`p` added to the existing `onKeydown` (alongside i/v/c/a/h/e).
    - A "Previous" button, disabled when there's no history, placed next to
      `<StudyAnswerControls>` in both the immersive `.answer-slot` and the
      non-immersive `.side` column (and in the `sessionComplete` state too,
      so finishing the last due card doesn't strand it), not inside
      `StudyAnswerControls.vue` itself since its `.answer-bar` is a strict
      two-column Fail/Pass grid.
    - One `<CardPreviewModal>` instance wired to the last history entry.

*Done when:* answering at least one card, then clicking "Previous" (or
pressing `P`), opens `CardPreviewModal` on the card just answered, with the
live player paused underneath; the button/hotkey does nothing before any
card has been answered; editing the previous card's local path inside the
modal and reopening it shows the edit; switching study scope makes
"Previous" unavailable again until a card in the new scope has been
answered; answering the live card again afterward still advances the queue
normally.

## Files / areas

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` (one `defineExpose`)
- `nuxt-app/app/pages/study/index.vue` (history tracking, button, hotkey,
  modal wiring)
- `nuxt-app/app/assets/css/main.css` - not originally planned, but needed:
  live verification caught the Preview modal rendering behind the immersive
  overlay (`--z-immersive: 60` outranks `CardPreviewModal`'s `--z-modal: 50`).
  Added one new token, `--z-above-immersive: 70`, and a scoped wrapper around
  just this feature's modal instance - the existing `--z-modal`/`--z-immersive`
  relationship (which `StudyAutoRevealSettingsModal` also has the same latent
  gap against) was deliberately left untouched, out of scope here.
- No changes to `StudyAnswerControls.vue`, `useStudySession.ts`,
  `CardPreviewModal.vue`, or any server route.

## Data / contracts

**Load-bearing for feature 52.** `SessionHistoryEntry { card: CardWithDetails;
result: "pass" | "fail" }` and the `sessionHistory` ref that holds them,
both in `study/index.vue`, are exactly the shape and the array feature 52
(study session log) will read to render its list - it should not need to
duplicate this tracking. No server/DB changes; `CardWithDetails` here is the
existing type already exported from `useStudySession.ts`.

## Verify

- `bun run build` passes clean - run three times across the work (initial
  implementation, after the z-index fix, and again as `/complete`'s own
  safety pass).
- Live browser verification (headless Chrome via CDP, this project's own
  pattern, no Playwright): answered a card on `/study`, confirmed the
  Previous button was absent beforehand and appeared after, clicked it, and
  confirmed via a fresh DOM read (not eyeballing) that `CardPreviewModal`
  opened on the correct card with the live player paused. Repeated in
  immersive mode using the `P` hotkey instead of a click.
- Caught a real bug during that verification: the modal was in the DOM but
  rendered visually behind the immersive overlay. Fixed (see Files/areas),
  then reverified with a before/after screenshot showing the fix actually
  working.
- Isolated a pre-existing hydration warning on `/study` (unrelated to this
  work) by `git stash`-ing this feature's changes and reproducing the same
  warning against unmodified `master` - confirmed not introduced here.
- Checked dev-server logs for JS errors across both verification runs: none
  beyond that one pre-existing hydration warning.
- Not independently re-verified live: scope-change resetting history, and
  the same-id resurfacing sync. Both are small, directly-traceable code
  paths rather than unverified guesses (see the spec's own Notes section,
  preserved above).
