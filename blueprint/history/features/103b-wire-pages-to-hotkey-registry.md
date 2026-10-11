# Feature: Wire Study, Listen and Preview to the hotkey registry (103b)

**From build-plan:** feature 103b (second sub-feature of 103, Configurable hotkeys + Space to play/pause)
**Status:** complete

**Prerequisite:** 103a (`app/utils/hotkeys.ts`, `useHotkeys()`) must be merged to
`master` first. Branch 103b from `master` after that.

## Goal

Every Study, Listen and Preview key press goes through the registry instead of a
hard-coded letter, Space plays and pauses alongside S, and every tooltip, legend
and button hint shows the key actually bound. There is no rebinding UI yet
(103c), so the only way to change a key is the saved `gaqSrs:hotkeys` value; the
defaults keep every existing key working.

## In scope

- Play/pause on Space and S in Study, Listen, Preview and the `/cards`
  inspector, with the Space safeguards below.
- Replace the hard-coded key checks in `StudyMediaPlayer.vue`, `CardInspector.vue`,
  `study/index.vue`, `StudyAnswerControls.vue` and `listen/index.vue` with
  `useHotkeys().actionFor(scope, event)`.
- Replace every typed-in key label with `hint(actionId)`: tooltips ("Hotkey: V"),
  Study's legend, `<kbd>` hints on Reveal, Next, Undo, Missed and Got it, and
  "Back to the video".
- Load saved bindings once at app start.

## Out of scope

- The Settings > Hotkeys section and the Display menu link (103c).
- Party mode hotkeys, and the fixed keys: Enter, Escape, Tab, and the
  typed-answer box keys (Up/Down, Space on an empty box, which already starts
  playback).
- A visible control for Previous card (`P`); it has none today and gets none here.
- Changing what any action does. Only how its key is found changes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Space and give-up policy (pure)** - add
  `app/utils/hotkeyTarget.ts` with `spaceYieldsToTarget` and
  `typedGiveUpApplies`, plus tests. *Done when:* `bun run test` passes and the
  tests cover every row of the policy table below.
- [x] **Step 2 - Boot, shared player, inspector** - call `refresh()` once from
  `app.vue`; add a `hotkeyScope` prop to `StudyMediaPlayer.vue` (default
  `"preview"`) and route its play/pause and expand keys through `actionFor`;
  apply the Space policy and ignore key repeat for play/pause; make
  `CardInspector.vue`'s pre-mount handler use the same action; pass
  `hotkey-scope="study"` / `"listen"` from the two pages; replace the player's
  "Hotkey: S" and "Hotkey: F" tooltips. *Done when:* in the browser, on `/cards`
  (inspector) and in a Preview, both Space and S start and pause playback and F
  expands; the tooltip reads "Hotkey: Space / S"; Space on a focused list row
  still selects it; `bun run build` passes.
- [x] **Step 3 - Study page and shared labels** - in `study/index.vue` swap the
  letter checks for actions (undo, flip, hide info/video/cover, ambient, previous
  card, session log, edit card), keep the typed-mode ignore of hide info/cover,
  and make `isRightArrowGiveUp` and `StudyAnswerControls.vue` follow the `pass`
  and `fail` bindings. Replace labels in the legend, the Session log and Undo
  tooltips, `StudyDisplayToggles.vue`, `StudyCardEditPanel.vue`,
  `StudyQuizResult.vue` and `StudyNowPlaying.vue`. *Done when:* every default
  Study key still does what it did, Space pauses, and with Typed Answers on the
  right arrow still gives up only with the caret at the end of a box.
- [x] **Step 4 - Listen page** - in `listen/index.vue` swap the checks for the
  `reveal`, `listenNext`, `listenPrevious` and shared toggle actions, and the
  Reveal and Next `<kbd>` hints. *Done when:* every default Listen key still
  works, Space pauses, and the hints read from the registry.
- [x] **Step 5 - Rebind proof in the browser** - no new code unless a bug
  turns up. With `playwright-cli`, save a custom `gaqSrs:hotkeys` value, reload,
  and check Study, Listen and Preview. *Done when:* the evidence table in
  Testing is filled with real results and a clean console.

## Files / areas

- New: `nuxt-app/app/utils/hotkeyTarget.ts`, `nuxt-app/app/utils/hotkeyTarget.test.ts`.
- Changed: `app/app.vue`, `app/composables/useHotkeys.ts` (a `claimSpace` helper),
  `app/components/study/StudyMediaPlayer.vue`, `app/components/card/CardInspector.vue`,
  `app/pages/study/index.vue`, `app/pages/listen/index.vue`,
  `app/components/study/StudyAnswerControls.vue`, `StudyDisplayToggles.vue`,
  `StudyCardEditPanel.vue`, `StudyQuizResult.vue`, `StudyNowPlaying.vue`.
- Unchanged: `CardPreviewModal.vue` keeps only its Escape handling; its player
  gets the default `preview` scope.

## Data / contracts

**Load-bearing:** 103c reuses the same registry calls, so nothing here may add a
second place that decides which key means what.

```ts
// app/utils/hotkeyTarget.ts
interface HotkeyTargetLike {
  tagName: string;
  getAttribute(name: string): string | null;
  closest(selector: string): unknown;
}
function spaceYieldsToTarget(scope: HotkeyScope, target: HotkeyTargetLike | null, dialogOpen?: boolean): boolean;
function typedGiveUpApplies(input: {
  passKeys: string[];     // the pass action's current keys
  key: string;            // normalised key pressed
  inTextField: boolean;
  caretAtEnd: boolean;
}): boolean;
```

**Space policy** (`spaceYieldsToTarget` returns true when Space must keep its
native job and the hotkey stands down; typing fields already stand down via
`useHotkeyGuard`):

| Focus is on | Scope | Result |
|---|---|---|
| nothing, `body`, or a non-interactive element | any | hotkey acts |
| a button, link, summary, select or `role` button/checkbox/switch/tab/menuitem/option/radio/link | study or listen, outside a dialog | hotkey acts; Space and its key-up are suppressed so the control is not also clicked |
| the same, inside `[role="dialog"]`, `[aria-modal="true"]` or `.backdrop` | any | hotkey stands down; the control gets Space |
| the same | preview (`/cards`, Preview modal), no dialog open | hotkey stands down, so Space on a focused table row or button still works |
| the same, outside the dialog | preview, a dialog is open | hotkey acts: the focused control is the one behind the modal (the row that opened a Preview) |

Reason for the split: on Study and Listen a click on a Display toggle leaves
that button focused, and Space should then pause, not flip the toggle again. On
`/cards` rows are buttons and Space is how a keyboard user selects one.

**Give-up rule** (`typedGiveUpApplies`): the key must be one of the pass keys.
Outside a text field it applies. Inside a text field it applies only for
`arrowright` with the caret at the end, as today; any other bound key (a letter)
is plain typing there.

## Testing

- **Unit-tested (Vitest, step 1):** both functions in `hotkeyTarget.ts`, with
  fake targets: every policy row above, a null target, a nested element inside a
  dialog, and every give-up case (not a pass key, text field with caret mid-text,
  caret at end, rebound letter inside a field, and outside a field).
- **Not unit-tested:** the Vue wiring and the labels. These ride on the browser
  evidence and `bun run build` (no typecheck script exists; run the strict `tsc`
  one-off on `hotkeyTarget.ts` as in 103a).
- **Browser evidence (step 5, `playwright-cli`, headless Chromium, production
  build against a throwaway copy of the database; results):**

| Check | Result |
|---|---|
| Study: Space, then S | Each toggles play/pause; page does not scroll |
| Study: click a Display toggle, press Space | Pauses; the toggle does not flip |
| Study (manual): Enter, right arrow, left arrow, U | Reveal, Pass, Fail and Undo all recorded |
| Study with Typed Answers: right arrow with focus outside a box | Gives up the round |
| Study with Typed Answers: right arrow inside a box | Only moves the caret, at the end too. The old build does the same (the boxes stop key events reaching the page), so this row was wrong in the spec and nothing changed |
| Study: V, I, A, L, D, E | Each works |
| Listen: Space, S, arrows, V, I, A, D, R | All work; Space with a toggle focused pauses |
| `/cards`: select a card, Space on the page; Space on a focused row | Plays; the row keeps Space and toggles its selection |
| Preview (from Stats): Space, S, F, Escape | Plays and pauses, expands, closes. Space with the opening row still focused behind the modal did nothing until the policy gained the open-dialog rule (see Data / contracts), then worked |
| Rebind on Study, Listen and `/cards` | New keys work, old keys do nothing, tooltips, legend and hints say the new keys |
| Unbind an action | Its legend entry, tooltip line and `<kbd>` are hidden |
| Console | No errors from this work. Study logs a hydration mismatch that the previous commit also logs; the isolated server's missing furigana dictionary logs 500s |

**Not verified:** Firefox (not installed; its Space key-up handling is
unchecked) and a keyboard-only walk through the page.

**Found, not fixed (outside this feature):** with a Preview open over Study
(Previous card, the session log), the Study player stays mounted and listening,
so S and Space toggle both players and two clips play at once. It pre-dates this
work for S.

## Notes for the AI

- Look up keys only through `useHotkeys()`. Never compare `event.key` to a
  letter for an action in the registry.
- Keep the guards each handler already has (typing target, `repeat`, `isComposing`,
  modal-open checks); only the "which key" part changes.
- Space claiming means `preventDefault` on the key-down and a one-shot key-up
  listener that also calls `preventDefault`, since Firefox activates a button on
  release. Put that in one `claimSpace(event)` helper in `useHotkeys()`.
- A tooltip or hint whose action has no keys renders nothing, not "Hotkey: ".
- Hints are read at render time from the shared state, so they update the moment
  bindings change; do not copy them into local constants.
- `refresh()` runs in `onMounted` in `app.vue`; labels render with defaults on the
  server and switch after mount, which is expected and must not log a hydration
  warning.
- No em dashes in code, comments or commit messages. Comments only for why.
