# Keep the Study desktop layout through the tablet breakpoint

**Type:** Fix

**Status:** verified

## The problem

The Study page's main video-and-sidebar layout intentionally stays desktop-shaped
until its 820px tablet breakpoint. Its typed-answer score control, however,
changes at 1100px and 1200px. Resizing a desktop window or using browser zoom can
therefore change the header's visual scale before the page reaches the tablet
layout, contrary to the desired stable desktop presentation.

## The fix

Keep the complete inline score control and its desktop spacing at every width
above 820px. Move any score-specific compact stacking behavior to the existing
tablet breakpoint, where the page already stacks the player and information pane.
Do not change the study grid, player controls, scoring values, or accessibility
label.

## Build steps

- [x] **Align the typed-answer score breakpoints with Study's tablet layout.**
   - Remove the 1100px and 1200px score-specific responsive changes that hide or
     stack desktop score details.
   - Add the compact score layout only at the Study tablet range (820px and below),
     preserving wrapping and readable values at narrow widths.
   - **Done when:** desktop widths above 820px retain the same inline Score,
     Combo, and Correct presentation, while tablet widths use the compact layout
     without overflow.

## Verify

- `bun run test` passed with 46 test files and 530 tests.
- `bun run build` passed.
- `bun run measure /study --base http://localhost:3001 --size 1280x720 --size 960x600 --size 821x700 --size 820x700 --size 768x700 --wait-for .study-grid --select ".study-grid,.player-pane,.side,.quiz-score"` confirmed the inline desktop score above 820px and the stacked tablet layout at 820px and below, without horizontal overflow.
