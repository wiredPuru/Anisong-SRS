# Fix: Immersive info overlay squished to one word per line on normal screens

**Type:** Fix
**Status:** verified

## The problem

Feature 31 (Immersive expanded study mode) added a `@media (min-width: 1400px)`
variant that moved the info card and Pass/Fail out of the video's own box to
"flank" it in the leftover margin on wide screens. In practice, the video
(`--video-width: min(90vw, calc((100vh - var(--nav-height)) * 0.9 * 16 / 9))`)
hits its `90vw` width cap on most normal monitors regardless of how wide the
window is - height rarely becomes the limiting factor - so the leftover
margin stays a roughly constant ~5vw per side no matter how large the window
gets. The wide-screen `max-width: calc(50vw - (var(--video-width) / 2) - 40px)`
formula assumed that margin would grow with window width; instead it
collapsed to a sliver, and the info card's title wrapped to one word per
line (screenshot: "Encouragement" / "of" / "Climb" / "Season" / "2", each on
its own row).

## The fix

Removed the `@media (min-width: 1400px)` flanking variant entirely. Both the
info card and Pass/Fail now always anchor inside the video's own letterboxed
box (the mode that was already correct), with the info card's `max-width`
changed from `calc(var(--video-width) * 0.55)` to
`min(340px, calc(var(--video-width) * 0.55))` - a `min()` cap so it never
grows unreasonably wide on a large video, and shrinks proportionally (not
below what fits) on a small one. This is robust at any window size since it
no longer depends on leftover margin, which was the actual flaw.

**Must not repeat:** any future "put UI content beside the video, not on
it" attempt needs to measure real leftover space (e.g. JS via
`ResizeObserver`/`getBoundingClientRect`, or a `@media` query keyed to
aspect ratio rather than raw width) - a `min-width` media query alone
doesn't tell you whether the video itself has consumed all the extra width.

## Build steps

- [x] **Step 1 - Remove the flanking variant, cap the info card's width
  robustly** - `nuxt-app/app/pages/study/index.vue`: deleted the
  `@media (min-width: 1400px)` block; changed `.side.immersive-overlay
  .info-slot`'s `max-width` to `min(340px, calc(var(--video-width) * 0.55))`.
  *Done when:* `bun run build` passes; the info card no longer depends on
  leftover viewport margin at any window size.
- [x] **Step 2 - Root-cause fix: stop replicating the video's positioning
  math entirely** - Step 1's fix still left the overlay positioned via
  `position: fixed` and a hand-derived `--video-width`/`50vw` formula
  meant to match the video frame's box. The user's next screenshot showed
  two more bugs from that same root cause: Pass/Fail overlapping the
  video's own scrub bar, and the info card overlapping the OP/ED badge.
  The real bug was assuming `.player-frame`'s top edge sits at
  `var(--nav-height)` - it doesn't, because the frame is *vertically
  centered* within a taller fixed container, not top-aligned, so a
  viewport-relative `top`/`bottom` calc can never exactly match its real
  edges without also replicating that centering math. Fixed at the root:
  `StudyMediaPlayer.vue` gained `<slot v-if="immersive" name="immersive" />`
  inside `.player-frame` itself (`position: relative`), and
  `study/index.vue` now passes `StudyInfoPanel` + `StudyAnswerControls`
  through that slot (via `<template #immersive>`) when immersive, instead
  of trying to overlay them from outside via viewport math. Since slot
  content becomes real DOM children of `.player-frame`, `.info-slot`/
  `.answer-slot` now use plain `position: absolute; top/left/right/bottom`
  values relative to the frame's own box - no formula duplication, no
  centering math, nothing left to get wrong. `useNavHeight()` and the
  `--nav-height` custom property, no longer used anywhere in
  `study/index.vue` once `--video-width` was removed, were deleted from
  that file too (`StudyMediaPlayer.vue` still uses `useNavHeight()` for
  its own unrelated top-inset). *Done when:* `bun run build` passes;
  `.info-slot`/`.answer-slot` are DOM children of `.player-frame`, not
  positioned via viewport-relative calc().

- [x] **Step 3 - Frosted background behind Pass/Fail for legibility** -
  once the overlap bugs were fixed, the user's next screenshot (a busy,
  high-contrast credits frame) showed Pass/Fail was still hard to read
  sitting directly on the video. The standard `--glass-surface` token
  (20% opacity) is tuned for this app's own UI chrome, not arbitrary video
  content, so `.answer-slot` instead reuses `.player-controls`' own
  already-proven-effective scrim color (`rgba(10, 6, 14, 0.75)`) as a
  solid background, plus `border: 1px solid var(--glass-border)` and
  `backdrop-filter: var(--glass-blur)` for the frosted look. `StudyInfoPanel`'s
  overlay treatment (text-shadow, from feature 31's original Step 2) was
  left as-is - the user only flagged Pass/Fail, and the title text in the
  same screenshot read fine against the same background. *Done when:*
  build passes.

## Verify

No test runner configured; pure CSS/template structure, no new logic.
`bun run build` passes at every step, `/study` and `/cards` return 200
against a scratch dev server. Not independently re-verified in a browser
by the agent (no browser tool available in this environment) - both
rounds of bugs were caught and reported by the user via screenshot; Step 2
in particular was a genuine escalation from "adjust the formula" to "stop
using a formula that can be wrong," which is inherently more robust but
still unverified by the agent's own eyes.
