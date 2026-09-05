# Current Feature

## Title
Remove the Study "hide controls" (👁/🙈) toggle

## Type
Fix

## Status
verified

## The problem
`/study` has a 👁/🙈 button (`H` hotkey) that hides/shows the entire
`StudyDisplayToggles` row (Video/Cover/Info/Auto reveal/Random start/
Ambient/Audio only) plus the info panel's language toggles
(`StudyInfoPanel`'s `hideToggles` prop). It predates the Akiba Neon redesign
(feature 50b), which already collapsed that row into one compact icon
strip - the thing this button exists to hide is no longer visually heavy
enough to be worth a dedicated hide/show toggle, so it's just extra chrome
now.

## The fix
Remove the mechanism entirely rather than leave dead state around it:

- `nuxt-app/app/pages/study/index.vue`: delete `showControls` (the ref, its
  `h`-key branch in `onKeydown`, the `v-if="showControls"` on
  `<StudyDisplayToggles>` so it always renders, the
  `:hide-toggles="!showControls"` prop passed to `StudyInfoPanel`, and the
  👁/🙈 `<button>` itself. The session-log button (📋) sits right next to it
  and shares the same `.controls-toggle-btn` CSS class - keep that class
  and the 📋 button untouched, only remove the eye-icon button element.
- `nuxt-app/app/components/study/StudyInfoPanel.vue`: delete the
  `hideToggles` prop (no other caller passes it) and the `v-if="!hideToggles"`
  guard on `.lang-toggles`, so the language toggle row always renders.
  Trim the stale `.panel-top` CSS comment's reference to "when hideToggles
  drops the language control entirely," since that case no longer exists.

Nothing else changes: Hide Video/Hide Info/Hide Cover, Auto Reveal, Random
Start, Ambient, Audio only, and the language toggles themselves keep their
existing behavior - only the ability to hide/show them as a group goes
away. `CardPreviewModal` never had a "hide controls" toggle of its own, so
it's unaffected beyond inheriting `StudyInfoPanel`'s now-unconditional
language toggles (which is what it already showed by default anyway, since
it never passed `hide-toggles`).

## Build steps

- [x] **1. Remove `showControls` and `hideToggles` end to end.** Delete the
  ref, hotkey branch, template conditionals, and the button in
  `study/index.vue`; delete the prop and its guard in `StudyInfoPanel.vue`.
  *Done when:* `/study`'s display-toggles row and the info panel's language
  toggles are always visible with no way to hide them; the 👁/🙈 button is
  gone from the header; the `H` key does nothing; the 📋 session-log button
  and its own hotkey (`L`) still work unchanged; `bun run build` has no
  unused-prop or dangling-reference errors.

## Verify
Load `/study` and confirm there's no eye-icon button in the header - only
the display-toggles row and the 📋 session-log icon. Confirm the language
toggle buttons (EN/Romaji/日本語/ふりがな) always show in the info panel.
Press `H` and confirm nothing happens. Press `L` and confirm the session
log still opens. `bun run test` should stay green (35/35) - this is a pure
UI removal, not new logic, so it rides on browser verification and the
build per `coding-standards.md`'s testing scope rule.

## Evidence

Driven against the running dev server with `bun run measure`:

- Header on `/study`: only the display-toggles row and the 📋 session-log
  icon remain - the eye-icon button and its `.tooltip` text are gone.
- `.lang-toggles` renders unconditionally (confirmed present and measured).
- `H` key: no `.backdrop` (session-log modal) opened, `.controls-toggle-btn`
  (the one remaining, session-log) unaffected - confirmed no-op.
- `L` key / clicking the 📋 button: `.backdrop` renders full-viewport,
  confirming the session log still opens.
- `CardPreviewModal.vue` grepped for `hideToggles`/`hide-toggles`: no
  matches - it never passed the prop, so it's unaffected.

`bun run test` (35/35, no regressions) and `bun run build` both passed clean.
