# Current Feature

## Title: Fix Learning tooltip/popover clipping and collision on narrow frames

**Type:** Fix

**Status:** verified

## The problem

The previous fix raised `.info-slot`'s z-index (via an `.info-slot-elevated`
modifier class) when the Learning chip's tooltip/popover is open, which
correctly stopped it from being hidden *behind* the immersive Pass/Fail
buttons. But a real-world screenshot on a vertical/portrait monitor shows two
remaining problems:

1. The tooltip text is visibly clipped at the bottom ("...he le" instead of
   "...the learning stage."). `.info-slot` (`app/pages/study/index.vue`) has
   `overflow-y: auto; overflow-x: hidden;` - the z-index fix only changed
   which layer paints on top, it didn't stop this separate overflow rule
   from clipping the tooltip/popover when they extend past `.info-slot`'s
   own box.
2. On a narrow/short player frame (a portrait monitor renders the video
   shorter), there's very little vertical room below the Learning chip
   before `.answer-slot` begins, so opening downward has nowhere to go
   without visually colliding with the buttons.

## The fix

Reuse the existing `.info-slot-elevated` mechanism (already wired to
`learningControlOpen`/`streak-control-open-change` from the last fix) rather
than adding new architecture:

- `app/pages/study/index.vue`: add `overflow: visible;` to
  `.info-slot-elevated`, so the tooltip/popover can render past `.info-slot`'s
  box without clipping while active. Normal (non-elevated) card content keeps
  today's scrollable/clipped behavior unchanged.
- `app/components/study/StudyInfoPanel.vue`: flip both
  `.learning-trigger .tooltip` and `.learning-popover` to open **upward**
  instead of downward - replace `top: calc(100% + 8px)` with
  `bottom: calc(100% + 8px)` on both rules. The Learning chip sits at the
  bottom of the card's own content (after title/song blocks), so opening
  upward uses room already within the card's vertical extent instead of
  needing new space below it where the Pass/Fail buttons live. Overlapping
  the card's own text briefly is far less disruptive than overlapping
  interactive buttons, and this holds for any frame aspect ratio, not just
  this one monitor.
- Same two rules: change the fixed `width: 220px` (tooltip) / `width: 240px`
  (popover) to `width: min(220px, 60vw)` / `width: min(240px, 60vw)`, since a
  fixed px width doesn't shrink on a narrow portrait frame the way this
  component's other overlay sizing already does (it uses `clamp(...cqw...)`
  throughout for exactly this reason - see the `.info-card.overlay` comment
  block).

Must not break:

- The non-immersive `.side` panel usage - no stacking/overflow conflict
  exists there, unaffected either way.
- The existing click-outside/Escape dismiss behavior for the popover.
- The hover tooltip's appearance on a normal-aspect-ratio frame where there
  already was enough room - should look effectively the same, just anchored
  above instead of below.

## Build steps

1. [x] **Flip anchor direction, relax overflow, adaptive width** - the three CSS
   changes above in `study/index.vue` and `StudyInfoPanel.vue`. Done when:
   `bun run build` passes, and the tooltip/popover's full text is no longer
   clipped in a manual check (the specific narrow-frame case can't be
   automatically verified without a browser, so this needs your confirmation
   on the actual vertical monitor).

## Verify

- Reopen the Learning chip's tooltip/popover on the same vertical monitor
  that showed the bug; confirm the full "Answer correctly N times..." text
  is readable and no longer overlapping the Pass/Fail buttons.
- Spot-check on a normal widescreen frame too, to confirm nothing regressed
  there (tooltip should now appear just above the chip instead of below,
  otherwise identical).
- Confirm the popover still opens/closes correctly (click, outside-click,
  Escape) in both orientations.

## Resolution

Confirmed fixed by the user on the actual vertical monitor that showed the
original bug.
