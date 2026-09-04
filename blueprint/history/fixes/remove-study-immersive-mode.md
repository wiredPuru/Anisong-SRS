# Fix: Remove Study's Expand/Immersive mode (E hotkey + icon)

**Type:** Fix
**Status:** verified

## The problem

`/study` still has an "Expand" toggle - the `E` hotkey and an expand icon
button on the video player - that switches into an immersive layout (card
info and Fail/Pass floated on top of the video, restored to this
overlay style by the recent rollback of feature 53). The user wants this
whole mechanism gone from the Study screen specifically: no icon, no
hotkey, no immersive layout at all. `CardPreviewModal` (the Preview modal
used from `/cards` and `/decks`) shares the same underlying
`StudyMediaPlayer` expand/immersive mechanism via its own `allow-expand`/
`v-model:immersive` wiring - confirmed with the user that Preview keeps its
own Expand button unchanged; only `/study`'s copy of this mechanism is
being removed.

## The fix

All changes are in `nuxt-app/app/pages/study/index.vue` only.
`StudyMediaPlayer.vue`, `StudyInfoPanel.vue`, and `CardPreviewModal.vue` are
not touched - `StudyMediaPlayer`'s expand button only renders when a caller
passes `allow-expand`, so Study simply stops opting in, while Preview's own
`:allow-expand="!editing"` keeps working exactly as today.

- Stop passing `:allow-expand="true"` and `v-model:immersive="immersive"` to
  `<StudyMediaPlayer>` - the expand icon disappears because Study no longer
  opts in.
- Remove the `e` branch from `onKeydown` (the `E` hotkey).
- Remove the `immersive` ref entirely, and every branch that depended on it:
  - The `<template v-if="immersive" #immersive>` block (the overlay's
    duplicate `StudyAutoRevealCountdown`, `.info-slot` info panel, and
    `.answer-slot` Previous/Fail/Pass buttons).
  - `:class="{ 'study-grid-immersive': immersive }"` on `.study-grid` (goes
    back to a plain `class="study-grid"`).
  - `:hide-listening-label="immersive && autoRevealCountdownActive"` on
    `StudyMediaPlayer` (drop the prop entirely - it only existed to avoid
    duplicating text with the immersive overlay).
  - `v-if="!immersive"` on `.side` (the side info panel becomes
    unconditional - it's the only layout now, exactly as it behaved for any
    session before feature 31 ever existed).
- Remove the `learningControlOpen` ref and its `@streak-control-open-change`
  listener - it existed only to fix a stacking-context issue inside the
  now-removed immersive overlay (`.info-slot-elevated`); the plain `.side`
  panel's own `StudyInfoPanel` never used it.
- Remove the `<span><kbd>E</kbd> immersive</span>` line from the hotkey
  legend.
- Remove the now-dead CSS: `.study-grid-immersive`, `.info-slot`,
  `.info-slot-elevated`, `.answer-slot`, `.answer-slot :deep(.answer-btn)`,
  `.answer-slot :deep(.answer-bar)`, and `.answer-slot :deep(.key)`.
- Trim the stale immersive-specific reasoning out of the
  `.study-overlay-anchor` comment (it currently explains why the Previous/
  session-log overlays must outrank `--z-immersive` "from inside immersive
  mode" - Study no longer has that mode, so the comment should say why the
  elevated z-index still applies, or the rule can drop back to the default
  stacking if nothing on this page still needs to outrank anything). Keep
  the `--z-above-immersive` token itself untouched - `StudySessionLogModal`
  and `CardPreviewModal`'s own (kept) immersive mode both still rely on it
  elsewhere.

### Must not break

- `CardPreviewModal`'s own Expand/immersive toggle (on `/cards`, `/decks`,
  and Study's own "Previous card"/session-log popups) - completely
  unaffected.
- Everything else on `/study`: Hide Video/Info/Cover, Random Start, Ambient
  mode, Auto Reveal (mode + countdown), the `H`/`S`/`P`/`L` hotkeys,
  Previous card, session log, and Pass/Fail all keep working in the single
  (now-only) side-panel layout.

## Build steps

- [x] Remove the `immersive`/`learningControlOpen` state, the `E` hotkey,
  and the immersive-only template branches in
  `nuxt-app/app/pages/study/index.vue` (script + template only, no CSS
  yet).
  - Done when: `immersive` and `learningControlOpen` no longer appear
    anywhere in the file's `<script>`/`<template>`; `StudyMediaPlayer` is
    called with no `allow-expand`/`v-model:immersive`/`hide-listening-label`
    props; `.side` renders unconditionally; the build passes. Confirmed:
    grep shows no remaining references outside CSS; `bun run build`
    succeeded.
- [x] Remove the now-dead immersive-only CSS rules (`.study-grid-immersive`,
  `.info-slot`, `.info-slot-elevated`, `.answer-slot` and its `:deep()`
  rules) and trim the stale immersive reasoning from the
  `.study-overlay-anchor` comment.
  - Done when: none of those selectors remain in the file, the build
    passes, and no other selector in the file references them. Confirmed:
    grep shows no remaining references; traced the prop chain to confirm
    `.player-card.expanded`/`--z-immersive` can never trigger on `/study`
    anymore (no `allow-expand`/`v-model:immersive` passed), so
    `.study-overlay-anchor`'s elevated z-index was safe to drop -
    `CardPreviewModal` and `StudySessionLogModal` both still stack
    correctly on their own z-index tokens; `bun run build` succeeded;
    runtime check via `bun run measure /study --key e` confirmed
    `.expand-btn`/`.player-card.expanded`/`.info-slot`/`.answer-slot` are
    all absent from the DOM.

## Verify

- `bun run build` passes.
- `bun run dev` -> `/study`: no expand icon on the player frame, pressing
  `E` does nothing, no `<kbd>E</kbd> immersive` line in the hotkey legend.
- `/cards` or `/decks` -> open a card's Preview: its own Expand button
  still works exactly as before (unaffected).
- Hide Video/Info/Cover, Random Start, Ambient, Auto Reveal, Previous card,
  and session log all still work normally on `/study`.
