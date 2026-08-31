# Current Feature

## Title: Editable study-settings chips (new-card limit + learning streak)

**Type:** Fix

**Status:** verified

## The problem

Two study-scheduling settings can currently only be changed by leaving the
study session and going to `/settings`:

- The daily new-card limit (`dailyNewCardLimit`) - and its chip only shows up
  at all once a limit is already set, so a first-time user has no visible cue
  that the feature exists.
- The box-1 "learning streak" requirement (`BOX_1_STREAK_REQUIRED = 3`,
  hardcoded in both `server/utils/study.ts` and
  `app/components/study/StudyInfoPanel.vue`) isn't configurable at all, and
  its "Learning N/3" chip has no explanation of what it means.

## The fix

Make both settings visible and editable directly from `/study`, via clickable
chips that open a small inline popover - no page navigation required.

### 1. New-cards-per-day chip: always visible + inline-editable

- The chip always renders whenever the scope-row renders (same structural
  condition as today), not only when a limit is set:
  - Limit set: "New cards today: N/Y" (unchanged text)
  - Limit off: "New cards today: N (no limit)"
- The chip becomes a `<button>` that toggles a popover anchored under it.
- Extract the existing inline `dailyNewCardLimit` logic in
  `app/pages/settings.vue` (checkbox ref, number ref, `isSettingDailyLimit`,
  `dailyLimitError`, the mirroring watch, `toggleDailyLimit`/
  `setDailyLimitValue`, and the matching markup/styles) into a new shared
  component `app/components/settings/NewCardLimitControl.vue`
  (`props: { limit: number | null }`, `emits: ["saved"]`, posts to the
  existing `/api/media-library/daily-new-card-limit`). Use it both in
  `/settings` (replacing the inline block) and in the new `/study` popover.
- Dismiss the popover the same way `NavBar.vue`'s search dropdown already
  does (lines ~175-182): a template ref on the popover container, a
  `mousedown` listener on `window` added in `onMounted`/removed in
  `onUnmounted` that closes it when the click lands outside that ref. Also
  close on `Escape` and on clicking the chip again.
- On `saved`, refresh so the numbers update immediately: export the
  composable's internal `fetchNext` from `useStudySession.ts`'s returned
  object (e.g. as `refresh`) and call it from `study/index.vue`.

### 2. Learning-streak chip: configurable requirement + tooltip + editable

A new global, persisted, always-on setting (no "off" state - minimum valid
value is `1`):

- Add `mediaLibrarySettings.boxOneStreakRequired` (integer, **not null**,
  default `3`) via a Drizzle migration, on the same singleton row
  `dailyNewCardLimit` already lives on.
- `server/utils/mediaLibrary.ts`: `getBoxOneStreakRequired()` /
  `setBoxOneStreakRequired(value)` (validate integer `>= 1`, reject anything
  else with `{ error }`).
- `GET /api/media-library` response gains `boxOneStreakRequired`.
- New `POST /api/media-library/box-one-streak-required` (same
  validate-then-delegate shape as `daily-new-card-limit.post.ts`).
- `server/utils/study.ts`: `computeNextBoxState(currentBox, currentStreak, result)`
  becomes `computeNextBoxState(currentBox, currentStreak, result, requiredStreak)`
  - stays a pure, parameterized function (good unit-test candidate later)
  rather than reading the setting internally. `recordReview` reads
  `getBoxOneStreakRequired()` and passes it through. Remove the hardcoded
  `BOX_1_STREAK_REQUIRED` constant from this file.
- `StudyInfoPanel.vue`: replace its own hardcoded constant with a
  `streakRequired: number` prop (`withDefaults` fallback of `3`). Chip text
  becomes "Learning N/{streakRequired}".
- Add a hover tooltip on the chip using this project's established
  convention (a sibling `<span class="tooltip">`, shown via
  `:hover`/`:focus-visible` on the parent - copy `study/index.vue`'s
  `.controls-toggle-btn .tooltip` pattern, ~line 288): something like
  "Answer correctly {streakRequired} times in a row to graduate this card
  out of the learning stage."
- Make the chip a `<button>` that opens a popover (same anchored +
  click-outside + Escape dismiss pattern as item 1). Extract
  `app/components/settings/BoxOneStreakControl.vue`
  (`props: { required: number }`, `emits: ["saved"]`, a single number input,
  min `1`, no on/off toggle). Use it both in this popover and add it to
  `/settings`' existing "Study" section next to the new-card-limit control,
  so the setting is discoverable both ways.
- `study/index.vue` adds one `useFetch("/api/media-library")` call (e.g.
  `studySettings`/`refreshStudySettings`) to source `boxOneStreakRequired`
  for the `StudyInfoPanel` prop and the popover's current value. On either
  popover's `saved` event, call both `refreshStudySettings()` and the
  study-session `refresh` from item 1, so both chips and future scheduling
  reflect the change immediately.

Must not break:

- Box-1 scheduling behavior at the default (`3`) is byte-for-byte identical
  to the currently-merged behavior.
- `CardPreviewModal.vue`'s existing `<StudyInfoPanel>` usages are unaffected
  - they don't pass `box`/`streak`/`streakRequired` and shouldn't need to;
  the Learning chip only renders when `box === 1` is explicitly passed.
- Settings' other sections (folders, default download folder, import deck)
  stay structurally untouched.
- The already-merged daily-new-card-limit scheduling/API semantics
  (validation, cap logic in `getNextDueCard`) are unchanged - only how it's
  displayed/edited changes.

## Build steps

1. [x] **Schema, migration, settings util, API** - add `boxOneStreakRequired` to
   `mediaLibrarySettings`, migrate, add the get/set util functions, add the
   field to `GET /api/media-library`, add the new POST route. Done when:
   `curl`ing the GET route shows `boxOneStreakRequired: 3` by default, and
   valid/invalid POSTs succeed/400 as expected.

2. [x] **Scheduling logic** - thread `requiredStreak` through
   `computeNextBoxState`/`recordReview`. Done when: with the setting left at
   `3`, a box-1 card still needs exactly 3 passes to graduate (regression
   check against the existing behavior); setting it to e.g. `2` and
   repeating the same test graduates on the 2nd pass instead.

3. [x] **Extract shared settings components** - `NewCardLimitControl.vue` and
   `BoxOneStreakControl.vue`, wire both into `/settings` (replacing the
   inline new-card block, adding the new streak block). Done when:
   `/settings`' "Study" section still round-trips the daily limit exactly as
   before, plus a new streak-required control that round-trips too.

4. [x] **`/study` popovers** - always-visible new-cards chip + popover, Learning
   chip's tooltip + popover, the new `studySettings` fetch, and the
   `useStudySession` `refresh` export. Done when: clicking either chip opens
   its popover with the current value, editing and saving updates both
   chips without a page reload, and clicking outside/Escape/re-clicking the
   chip closes the popover.

5. [x] **Fix tooltip/popover stacking bug** - the Learning chip's tooltip
   (and its popover) render behind the immersive Pass/Fail buttons. Found
   via manual browser testing after step 4: `.info-slot` and `.answer-slot`
   in `study/index.vue` are separate absolutely-positioned siblings sharing
   `z-index: 10`; `.answer-slot` paints after `.info-slot` in DOM order, so
   nothing nested inside `.info-slot` (including a locally high z-index on
   the tooltip) can out-rank it - a child's z-index never escapes its
   parent's stacking context. Fix: track whether the Learning
   tooltip/popover is actually open in `StudyInfoPanel.vue` (hover/focus for
   the tooltip, the existing `showStreakPopover` ref for the popover), emit
   that combined boolean up, and bind a modifier class on `.info-slot` in
   `study/index.vue` that temporarily raises its z-index above
   `.answer-slot`'s only while open - preserving the deliberate
   `.answer-slot`-wins-by-default behavior for normal (non-elevated) info
   card content. Done when: opening the Learning popover (or hovering its
   tooltip) visibly renders above the Pass/Fail buttons in immersive mode.

## Verify

- On `/study`, confirm the new-cards chip is visible even with no limit set
  ("New cards today: N (no limit)"), and clicking it opens a popover with
  the same toggle/number control as `/settings`.
- Set a limit from that popover, close it, confirm the chip updates to
  "N/Y" immediately (no reload).
- Confirm the Learning chip shows a tooltip on hover explaining the
  mechanic, and clicking it opens a popover to change the required streak.
- Change the required streak to `2`, verify a box-1 card now graduates after
  2 passes instead of 3 (regression: confirm `3` still behaves as it does
  today before changing it).
- Confirm both popovers dismiss on outside click, `Escape`, and re-clicking
  their chip.
- Confirm `/settings`' "Study" section still shows and correctly round-trips
  both controls.
- No test runner configured yet; `computeNextBoxState` remains a good
  `/tests` candidate later, but it's optional here.
