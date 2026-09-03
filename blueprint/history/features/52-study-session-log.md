# Feature: Study session log

**From build-plan:** feature 52
**Status:** verified

## Goal

Give the user a browsable list of every card presented so far in the current
`/study` session (song / artist / anime, pass or fail), so they aren't limited
to feature 51's "Previous" (which only ever shows the single most recent
card). Clicking any entry opens it the same way "Previous" already does -
`CardPreviewModal`, paused live player, view-only.

This builds directly on feature 51's `sessionHistory` array in
`study/index.vue` - no new tracking, just a new way to browse and select from
data that already exists.

## In scope

- A new `StudySessionLogModal.vue` component (small popup, matching
  `StudyAutoRevealSettingsModal.vue`'s existing shape: backdrop, panel, close
  button, Escape-to-close) listing every `sessionHistory` entry, newest
  first, each row showing song title, artist name, anime title (English),
  and a Pass/Fail chip (`--pass`/`--fail` tokens, matching
  `StudyAnswerControls`' own color usage).
- An empty state ("No cards reviewed yet this session.") when
  `sessionHistory` is empty - the trigger button is always clickable, not
  disabled, unlike "Previous."
- A small icon trigger button (`📋`, hotkey `L`) in the header's
  `.header-right`, next to the existing "Hide/show controls" button -
  styled and structured the same way (`.controls-toggle-btn`, tooltip
  span), always visible regardless of `showControls`.
- Clicking a log row opens that entry's card in `CardPreviewModal` (closing
  the log panel first, so only one overlay shows at a time) - generalizing
  feature 51's `openPreviousCard()`/`showPreviousCard` into a single
  `openHistoryCard(entry)` / `viewedHistoryEntry` mechanism that both
  "Previous" and the log's rows now share. "Previous" keeps its exact
  existing behavior (button, `P` hotkey, same done-when from feature 51) -
  this is an internal generalization, not a behavior change.
- **A correctness fix found while designing this feature, applied here since
  it's the same mechanism**: neither the log panel nor feature 51's
  "Previous" overlay blocked the live Pass/Fail hotkeys
  (`ArrowLeft`/`ArrowRight`, handled in `StudyAnswerControls.vue`'s own
  `window` keydown listener). Pressing an arrow key while either overlay was
  open silently submitted a review for the still-live card behind it -
  box/interval change and a new `ReviewLog` row, invisible to the user. Both
  overlays now disable the live answer controls while open, via the
  `disabled` prop `StudyAnswerControls` already had (previously wired only
  to `reviewing`).
- Both overlays (`CardPreviewModal` via `viewedHistoryEntry`, and the new
  log modal) render above Study's immersive layer - reusing feature 51's
  `--z-above-immersive` token and its wrapper (renamed from
  `.previous-card-modal-anchor` to `.study-overlay-anchor` to reflect that
  it now holds two overlays, not one).

## Out of scope

- **Persisting the log across a reload**, exporting it, or clearing it
  independently of the session - it's exactly `sessionHistory`, which is
  already in-memory-only and already resets on scope change (feature 51).
- **Sorting or filtering.** Always newest-first, no controls.
- **Submitting a new review from the log.** Same as "Previous" - Preview has
  no pass/fail controls, so this falls out for free.
- **Fixing `StudyAutoRevealSettingsModal`'s own immersive-stacking gap.** It
  has the same underlying issue (renders at `--z-modal`, below
  `--z-immersive`) that feature 51 found and fixed for `CardPreviewModal`,
  but that component isn't touched by this feature and stays out of scope,
  exactly as feature 51 already decided.
- **Blocking every hotkey while an overlay is open**, not just Pass/Fail.
  Toggling Hide Video/Ambient/etc. behind an open modal has no lasting
  effect (nothing is written, nothing advances), so only the
  mutating/advancing action (Pass/Fail) is guarded.

## Build steps

- [x] **Step 1 - Session log panel + generalized overlay mechanism** - one
  reviewable step (the new component is meaningless without the trigger and
  the generalized open/select wiring, and the Pass/Fail guard fix belongs
  with the overlay mechanism it protects).

  - New `nuxt-app/app/components/study/StudySessionLogModal.vue`: props
    `entries`/`open`, emits `close`/`select`; newest-first list (keyed by
    original chronological index), empty state, Escape/backdrop close,
    styled to match `StudyAutoRevealSettingsModal.vue` but at
    `--z-above-immersive` with an internally-scrolling `.log-list`
    (`max-height: min(600px, 80vh)`).
  - `study/index.vue`: generalized `showPreviousCard`/`previousCardEntry`
    into `viewedHistoryEntry` + `openHistoryCard(entry)` (shared by
    "Previous" and the log's row-click, which also closes the log panel);
    generalized the `updated`-event sync to patch every `sessionHistory`
    entry sharing a card id, not just the last; added the `L` hotkey and
    header trigger button; added `viewedHistoryEntry !== null ||
    showSessionLog` to both `<StudyAnswerControls>`'s existing `:disabled`
    binding; renamed `.previous-card-modal-anchor` to
    `.study-overlay-anchor`, now wrapping both overlays.

*Done when:* clicking the 📋 button (or pressing `L`) opens a list of every
card reviewed this session, newest first, each with a Pass/Fail chip and
song/artist/anime; clicking a row opens that exact card in
`CardPreviewModal`, paused, and closes the log panel; with the log panel or
a history-card Preview open, pressing `ArrowLeft`/`ArrowRight` does not
submit a review for the live card; feature 51's "Previous" still works
exactly as before; both overlays render above the immersive layer.

## Files / areas

- New: `nuxt-app/app/components/study/StudySessionLogModal.vue`
- `nuxt-app/app/pages/study/index.vue` (generalized overlay state,
  trigger button, hotkey, Pass/Fail guard fix, wrapper rename)
- No changes to `StudyMediaPlayer.vue`, `StudyAnswerControls.vue`,
  `useStudySession.ts`, `CardPreviewModal.vue`, `main.css`, or any server
  route.

## Data / contracts

None new. Reuses feature 51's `SessionHistoryEntry`/`sessionHistory` exactly
as flagged load-bearing in that feature's spec.

## Verify

- `bun run build` passes clean - run twice (during `/implement`, and again
  as `/complete`'s own safety pass).
- Live browser verification (headless Chrome via CDP, no Playwright):
  confirmed the empty state before any answer, that Escape closes the
  panel, that answering a card adds exactly one correctly-labeled row, that
  clicking a row opens the right card in `CardPreviewModal` and closes the
  log, and that the log grows to two entries after a second answer -
  screenshot confirms newest-first ordering and correct Pass chip styling.
- **Guard-fix verification, the important one**: captured the "Card N"
  header counter, opened a history card in Preview, pressed `ArrowRight`,
  and confirmed via a fresh DOM read that the counter did **not** change;
  then closed Preview and pressed `ArrowRight` again, confirming the
  counter *did* advance normally - proves the fix blocks the bug without
  over-blocking real reviews.
- Repeated the open/hotkey/render checks in immersive mode (`E` then `L`):
  screenshot confirms the log panel renders above the immersive layer, not
  behind it.
- Checked dev-server logs across both verification runs: no new JS errors,
  only the same one pre-existing `/study` hydration warning already
  isolated as unrelated during feature 51's work.
