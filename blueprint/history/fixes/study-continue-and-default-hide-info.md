# Fix: Continue replaces Fail/Pass (not appends), Info hidden by default

**Type:** Fix
**Status:** verified

## The problem

Two follow-ons from the just-shipped reveal-and-confirm fix
(`blueprint/history/fixes/study-hide-info-reveal-confirm.md`):

1. When a grade is pending confirmation, `StudyAnswerControls.vue` rendered
   the disabled Fail/Pass row **and** a separate Continue button below it - a
   third row that adds height the side panel didn't need before. At a
   zoomed-in browser (a shorter effective viewport), that extra row pushes
   Continue past the fold, so it's visible but hard to reach without
   scrolling - screenshot showed Continue clipped at the very bottom of the
   window while the still-visible, still-rendered (if disabled) Fail/Pass
   buttons above it took up space that was now pointless, since neither could
   be pressed.
2. Hide Info (feature 10) still defaulted to off (Info visible) at the start
   of every session. Given the reveal-and-confirm mechanic exists specifically
   to support studying with Info hidden, defaulting to visible undersold it -
   every session needed a manual toggle before the new behavior did anything.

## The fix

1. **Replace, don't append.** In `StudyAnswerControls.vue`, when
   `pendingAdvance` is true, a single full-width Continue button renders in
   the exact grid area Fail/Pass otherwise occupy (same `.answer-bar` grid,
   spanning both columns via `grid-column: 1 / -1`) instead of disabling
   Fail/Pass and adding a new row underneath. Total control height stays
   identical to the normal Fail/Pass state.
2. **Default Hide Info to on.** `hideInfo` in `study/index.vue` starts `true`
   instead of `false`. Still session-only (resets every visit, like Hide
   Video/Random start/Ambient mode) - this only changes the reset value, not
   the toggle's behavior or persistence.
3. **Verified the fit at a shorter viewport** with `bun run measure` rather
   than assuming - `.side` already had `overflow-y: auto`, so the question
   was whether that was actually enough post-fix, not whether to add more CSS.

## Build steps

- [x] **1. Replace Fail/Pass with Continue in `StudyAnswerControls.vue`.**
  `.answer-bar`'s grid now holds either the Continue button (`v-if
  pendingAdvance`, `grid-column: 1 / -1`) or the Fail/Pass pair (`v-else`),
  never both. Removed the old standalone Continue block's `width: 100%` /
  `margin-top: 12px` - the grid spanning handles sizing now. Keyboard handling
  unchanged. *Done when:* only one button renders during `pendingAdvance`, no
  leftover disabled Fail/Pass, same total height as normal state.

- [x] **2. Default Hide Info to on in `study/index.vue`.**
  `const hideInfo = ref(true);` (was `ref(false)`). No other change. *Done
  when:* a fresh load (`localStorage` cleared) shows Info blurred by default.

- [x] **3. Confirm the fit at a shortened viewport.**
  `bun run measure /study --size 1440x700 --click-text "Fail" --select ".side,
  .answer-bar, .continue-btn" --wait-for ".answer-btn.fail"` and again at
  `1440x560`. *Done when:* `.side` scrolls cleanly and Continue is found with
  real dimensions, never collapsed or unreachable.

## Verify

`bun run test` (35/35, no regressions) and `bun run build` both passed clean
throughout - this is UI/interaction and layout behavior, not pure logic, so it
rode on browser/geometry evidence rather than a new unit test (per
`coding-standards.md`'s testing scope rule).

Driven-browser evidence (CDP, since Playwright isn't installed):

- Measured `.answer-bar`'s bounding box on the same card before and after
  grading: **78px tall both times** - confirmed Fail/Pass are actually removed
  (not just disabled) when Continue appears, so no extra row is added.
- Cleared `localStorage` and reloaded `/study` fresh: Info panel starts
  blurred, toggle shows off - confirms the new default.

`bun run measure` results (this project's real-rendered-geometry tool):

| Viewport | `.side` | `.continue-btn` |
|---|---|---|
| 1440x900 (normal) | fits, no scroll | fully `insideViewport: true` |
| 1440x700 (zoom stand-in) | `scrollsInternally: true` | found, real dimensions, reachable by scroll |
| 1440x560 (aggressive zoom stand-in) | `scrollsInternally: true` | found, real dimensions, reachable by scroll |

At normal window heights nothing scrolls at all; at short/zoomed heights the
existing `.side { overflow-y: auto }` reaches it cleanly - nothing collapses
or gets stranded outside the scrollable area at any tested height.
