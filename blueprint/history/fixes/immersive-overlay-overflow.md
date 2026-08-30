# Fix: Immersive overlay overflows instead of scaling with the video frame

**Type:** Fix
**Status:** verified

## The problem

`/study`'s immersive mode (`E` hotkey) overlays the info card, language
toggles, and Pass/Fail buttons directly on top of the video via
`StudyMediaPlayer.vue`'s `.player-frame`. That frame already scales
responsively to fit the viewport:

```css
.player-card.expanded .player-frame {
  width: min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9));
}
```

but everything absolutely-positioned inside it does not:

- `StudyInfoPanel.vue`'s `.info-card.overlay` styling (title/romaji/JP text,
  song title, artist name, chip padding) uses fixed px font-sizes (up to
  27px) and padding.
- `StudyAnswerControls.vue`'s `.answer-btn` (Pass/Fail) uses fixed
  `padding: 20px` and `font-size: 18px` for both buttons side by side.
- `study/index.vue`'s `.info-slot`/`.answer-slot` position the above with
  fixed px offsets (`top: 60px`, `bottom: 90px`, etc.).

When the frame is forced small - a narrow browser window, or a short/wide
window where the height-based half of that `min()` wins - the fixed-size
overlay content no longer fits inside the shrunken frame and spills past its
edges instead of scaling down with it. The user's screenshot shows exactly
this: the Fail/Pass buttons rendering larger than the frame and overlapping
past its bottom edge, instead of the clean, fully-contained layout the same
overlay shows at a normal window size.

## The fix

Give `.player-frame` a CSS containment context (`container-type:
inline-size`) so its descendants can size themselves relative to the
frame's actual rendered width rather than the raw viewport - the frame's own
width is already the thing correctly accounting for both the 90vw cap and
the height-derived cap, so querying against it (rather than `vw`) tracks
whichever constraint is actually active.

Convert the overlay's fixed px values to `clamp(<min>, <N>cqw, <current px
value>)`, using each existing value as the clamp's **upper bound** - so at
today's normal/large window sizes nothing changes (the `cqw` term already
exceeds the old fixed value and gets clamped to it, same as now), and it only
shrinks once the frame gets small enough that the `cqw` term drops below that
ceiling. Apply this to:

- `StudyInfoPanel.vue`: `.info-card.overlay`'s font-sizes (`.en`, `.romaji`,
  `.jp`, `.song-title`, `.label`, `.meta-row .name`), the `.title-block`/
  `.song-block`/`.meta-row` padding, and `.lang-btn` padding/font-size.
- `StudyAnswerControls.vue`: `.answer-btn` padding/font-size/gap and `.key`
  padding/font-size.
- `study/index.vue`: `.info-slot`/`.answer-slot`'s px offsets (`top`,
  `left`, `right`, `bottom`) - same clamp treatment, ceiling at today's
  values.

**Must not break:**

- The normal (non-immersive) `.side` panel and `CardPreviewModal`'s own
  panel are untouched - only the `.overlay`-class / immersive-only rules and
  `StudyAnswerControls` (used by both immersive and non-immersive layouts,
  where it already sits in normal document flow, not absolute-positioned -
  the clamp's ceiling equalling today's value means it looks identical
  there too).
- Normal-size desktop appearance must look pixel-identical to today, since
  every clamp ceiling is today's existing fixed value.
- Container query units (`cqw`, `container-type`) are baseline-supported in
  all current major browsers (Chrome 105+, Safari 16+, Firefox 110+); this
  is a personal, local-only app run in the developer's own modern browser,
  so no fallback is needed.

**Revised in Step 3:** the "ceiling at today's value, never grow past it"
design above turned out wrong - on a frame wider than the reference range,
it left the overlay pinned at its original size while the frame around it
kept growing, so it read as undersized instead of matching the reference's
proportions. Step 3 recalibrates every clamp to scale proportionally in
both directions (shrink on a small frame, grow on a large one), with only a
generous sanity ceiling left as a safety cap. Steps 1 and 2's *mechanism*
(container queries, the max-height/scroll bound) still stands - only the
clamp ceiling values changed.

## Build steps

- [x] **Step 1 - Scale the immersive overlay with the frame instead of the
  viewport** - add `container-type: inline-size` to `.player-frame`
  (`StudyMediaPlayer.vue`); convert the fixed px sizes listed above in
  `StudyInfoPanel.vue`, `StudyAnswerControls.vue`, and `study/index.vue`'s
  `.info-slot`/`.answer-slot` to `clamp(min, Ncqw, currentPxValue)`. *Done
  when:* at a normal desktop window size, immersive mode looks unchanged
  from before this fix; at a deliberately cramped window size (narrow, or
  short-and-wide), the info card, language toggles, and Pass/Fail buttons
  shrink to stay fully inside the video frame's edges instead of
  overflowing or overlapping past them.
- [x] **Step 2 - Bound the info card's height so it can't grow under the
  Pass/Fail bar** - found during manual verification of Step 1: shrinking
  proportionally with the frame's *width* (cqw) doesn't stop the info
  card's content from being taller than a *short* frame - a wrapped
  two-line title stacked with romaji/JP/song/artist can still exceed the
  vertical gap above `.answer-slot`, which paints after it in DOM order and
  silently hides whatever it overlaps (the user's screenshot shows "Studio
  S" cut off behind the Pass/Fail bar, not spilling past any edge - the
  original failure mode, but a new one). Add `max-height: 67%;
  overflow-y: auto; overflow-x: hidden;` to `.info-slot`
  (`study/index.vue`) - a percentage bound scales with the frame like the
  rest of this fix, sized to leave room for the top offset and
  `.answer-slot`'s reserved space in both the fixed-px and %-based offset
  regimes; overflow becomes scrollable rather than hidden-behind-the-bar in
  the rare case content still doesn't fit even at the smallest clamped text
  size. *Done when:* at the same cramped window size that reproduced the
  overlap, the info card's content never renders under the Pass/Fail bar -
  either it fits, or it becomes scrollable within its own bounds.
- [x] **Step 3 - Make the overlay scale proportionally instead of only
  ever shrinking** - found during manual verification of Steps 1-2, on a
  *large* frame this time: every clamp from Step 1 used today's fixed px
  value as its ceiling, so overlay content could shrink below that value
  but never grow past it. On a frame wider than the ~1200-1450px range
  those ceilings were tuned against, the overlay stayed pinned at its
  original absolute size while the frame around it kept growing, so it
  read as undersized/sparse relative to the frame instead of keeping the
  same proportions the reference screenshot showed. Rework every clamp in
  `StudyInfoPanel.vue`'s `.info-card.overlay` rules and
  `study/index.vue`'s `.answer-slot :deep(...)` rules from `clamp(min,
  Ncqw, todaysPxValue)` to `clamp(min, Ncqw, generousSanityCeiling)` -
  each `N` recalibrated so a ~1450px-wide frame (a typical desktop
  immersive size) reproduces today's original look, with the new ceiling
  only a safety cap against an unrealistically huge display, not the
  normal-range target. Convert `.info-slot`/`.answer-slot`'s offsets
  (`top`/`left`/`right`/`bottom`) and `.info-slot`'s `max-width` from
  `min(px, %)`/`min(px, ...)` to plain percentages on the same reference
  basis, so position and width scale proportionally too, not just font
  size. *Done when:* at a frame noticeably larger than ~1450px wide, the
  overlay's text/padding/spacing visibly scales up to match, instead of
  staying pinned at the smaller reference size; at a normal ~1450px frame
  it looks like the original reference; at a cramped frame it still
  shrinks and never overflows or overlaps (Steps 1-2 still hold).

## Verify

- `/study`, press `E` for immersive, at a normal browser window size -
  compare against the current look, should be unchanged.
- Resize the window to something deliberately cramped (narrow, and
  separately short-and-wide) while immersive - the info card, language
  toggles, and Pass/Fail buttons should all shrink to stay inside the video
  frame, never spilling past its edges.
- No test runner is configured and this is pure CSS/layout, not logic - ride
  on the browser check above plus `bun run build`.
