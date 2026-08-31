# Fix: proportional scaling for immersive overlay elements (badge, expand button, and bottom player controls)

**Type:** Fix
**Status:** verified

## The problem

In immersive/expanded study mode (`StudyMediaPlayer.vue`), several overlay
elements are positioned and sized with fixed pixel values while their
neighbors scale proportionally against `.player-frame`'s own rendered width
(`container-type: inline-size`, `clamp(min, Xcqw, max)`/`%`, calibrated
against a ~1450px reference frame). This mismatch causes overlaps at
non-reference frame sizes:

1. The theme-slot badge (top-left, `.theme-badge`) and the expand/collapse
   button plus its "Hotkey: E" tooltip (top-right, `.expand-btn` /
   `.expand-btn .tooltip`) - fixed `top: 16px`, `right`/`left: 16px`,
   `width`/`height: 36px`, `font-size: 16px`/`13px` - vs. `.info-slot` below
   them, which is proportional (`top: 7.36%`). On a small/narrow frame the
   fixed-height badge can extend below where `.info-slot` begins, overlapping
   the language-toggle row underneath it.
2. `.player-controls` (the bottom playback bar: play button, scrub bar, time,
   volume) - fixed `padding: 14px 16px`, `.play-btn` `48px`, `.scrub` `7px`,
   `.time`/`.volume-icon` `font-size: 14px`, `.volume-slider` `90px` - vs.
   `study/index.vue`'s `.answer-slot` (Pass/Fail bar), which is positioned
   proportionally (`bottom: 11.03%`). At smaller frame sizes the fixed-height
   controls bar no longer fits under that proportional clearance, so the play
   button visibly overlaps the bottom edge of the Pass/Fail bar (confirmed
   via screenshot).

Only the expanded/immersive presentation is affected in both cases - the
normal non-expanded card (`/cards` Preview, non-immersive `/study`) keeps its
current fixed sizing, which is correct there since that frame's size doesn't
vary the same way. `.player-controls` renders in both modes (it's outside the
`v-if="immersive"` slot), so its expanded-only override must not touch the
non-expanded rendering.

## The fix

Added expanded-only overrides (scoped under `.player-card.expanded`, matching
the existing pattern for `.player-card.expanded .player-frame`) that convert
fixed px values to `clamp(min, Xcqw, max)`:

- `.theme-badge`: `top`/`left`, `padding`, `font-size`.
- `.expand-btn` (+ `.tooltip`): `top`/`right`, `width`/`height`, `font-size`;
  tooltip `padding`, `font-size`, and its `top` gap offset.
- `.player-controls`: `padding`, `gap`.
- `.play-btn` (+ its shared `.tooltip`): `width`/`height`, `font-size`;
  tooltip `padding`, `font-size`, and its `bottom` gap offset.
- `.scrub`: base and hover/dragging `height`.
- `.time`: `font-size`, `min-width`.
- `.volume-icon`: `font-size`. `.volume-slider`: `width`.

Each `cqw` multiplier is calibrated so a ~1450px-wide frame lands on today's
existing px value (the conversion `value / 1450 * 100` holds for vertical
values too, since `.player-frame` keeps a fixed 16:9 aspect ratio - height
scales in lockstep with width). Each `clamp()` keeps a floor/ceiling of
roughly 0.6x/1.6x the base value, matching the ratios already used by
`StudyInfoPanel.vue`'s `.info-card.overlay` rules, so controls stay legible
and tappable on a very small frame and don't grow absurdly large on a very
wide one.

`study/index.vue`'s `.answer-slot` `bottom` changed from a plain `11.03%` to
`max(11.03%, 60px)`, so its clearance never shrinks below the controls bar's
own clamped floor height, even at extreme small widths where both clamps
bottom out.

**Must not change (kept intact):**

- Non-expanded/non-immersive sizing (Preview modal, non-immersive `/study`) -
  base (non-`.expanded`) rules stayed fixed px.
- Existing visual style (colors, borders, blur, gradients) - only
  size/position/spacing became proportional.

## Build steps

- [x] **Step 1 - Badge and expand button** - added
  `.player-card.expanded .theme-badge` and `.player-card.expanded
  .expand-btn` (plus its `.tooltip`) override rules with `clamp()`-based
  proportional values in `StudyMediaPlayer.vue`, calibrated against the
  ~1450px reference frame. *Done when:* toggling immersive mode at a very
  narrow browser width shows the theme badge and lang-toggle row with visible
  separation (no overlap), and at a very wide browser width the badge/expand
  button are visibly larger but still proportioned like the rest of the
  overlay.
- [x] **Step 2 - Bottom player controls** - found during review of Step 1:
  the user's screenshot after Step 1 showed the play button overlapping the
  Pass/Fail bar at the bottom of the frame - the same fixed-px-vs-proportional
  mismatch, just at the bottom of the overlay instead of the top. Added
  `.player-card.expanded .player-controls` (and its
  `.play-btn`/`.tooltip`/`.scrub`/`.time`/`.volume-icon`/`.volume-slider`
  descendants) proportional overrides in `StudyMediaPlayer.vue`, and changed
  `study/index.vue`'s `.answer-slot` `bottom` to `max(11.03%, 60px)`. *Done
  when:* in immersive mode at the frame size from the reported screenshot
  (~990px-wide player frame) and narrower, the play button and scrub bar no
  longer overlap the Pass/Fail bar.

## Verify

- No test runner or `Verify` command is configured, and this is pure CSS
  proportional-sizing with no logic - not eligible for the test gate.
- No Playwright/browser-screenshot tool was available during this build, so
  automated visual proof of the narrow/wide viewport behavior wasn't
  captured directly; the fix was reasoned through the calibration math
  (`value / 1450 * 100`, verified against the fixed 16:9 aspect ratio) and
  the dev server was confirmed serving `/study` at 200 with no build/HMR
  errors after each change.
- `bun run build` passed cleanly (production build, no errors).
- Manual check going forward: `/study`, press `E` for immersive, resize
  narrow (~500-900px) and wide (~1800px+) - the badge, expand button, and
  bottom play/scrub/volume bar should stay visibly separated from their
  neighbors and scale together at every size. Non-immersive `/cards` Preview
  and non-immersive `/study` should look unchanged.
