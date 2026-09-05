# Current Feature

## Title
Pass/Fail flash feedback on Study

## Type
Fix

## Status
verified

## The problem
On `/study`, grading a card via Pass/Fail (or the Left/Right arrow hotkeys)
gives no immediate visual confirmation of which way it was graded - the only
feedback is the queue silently advancing to the next card. The existing
`--pass`/`--fail` color tokens (`main.css:29-32`) are used elsewhere (button
accents, chips) but nothing currently flashes them at the moment of grading.

## The fix
Add a brief color flash over the player pane the instant a review is
successfully submitted, using the existing `--pass`/`--fail` tokens - green for
a pass, red/pink for a fail. Purely visual, session-only, no new state
persisted.

- Trigger point: `submitReview()` in `app/pages/study/index.vue`, at the same
  spot that already gates on `reviewedCount.value !== countBefore` (a real,
  successful review - not a no-op double-submit or a failed request).
- Render as an absolutely-positioned overlay inside `.player-pane`, styled
  as a border/glow pulse (matching the app's existing glow-over-fill
  convention from feature 24) rather than a solid color wash over the video.
- Auto-clears itself after the animation (~500ms) via a single tracked
  timeout, so a rapid pass-then-fail (e.g. a fast keyboard grader) restarts
  the flash cleanly instead of stacking timers.
- Must not intercept clicks/hover on the video underneath (`pointer-events:
  none`) and must not affect `CardPreviewModal` (Preview has no grading, so
  this is `/study`-only).

## Build steps

- [x] **1. Add the flash state and overlay.**
  In `app/pages/study/index.vue`: add a `gradeFlash = ref<"pass" | "fail" |
  null>(null)` and a tracked timeout id. In `submitReview()`, right after the
  existing `reviewedCount.value !== countBefore` check succeeds, set
  `gradeFlash.value = result`, clear any prior pending timeout, and start a
  new one that resets `gradeFlash.value = null` after the animation duration.
  Add a `<div class="grade-flash" :class="gradeFlash" v-if="gradeFlash"
  aria-hidden="true" />` inside `.player-pane`, alongside `StudyMediaPlayer`.
  Give `.player-pane` `position: relative` and style `.grade-flash` as an
  inset-0, `pointer-events: none` overlay with a `box-shadow`/border glow in
  `var(--pass)` or `var(--fail)` (via `.grade-flash.pass` /
  `.grade-flash.fail`), animated with a scoped `@keyframes` fade-in/out over
  ~500ms.
  *Done when:* grading a card Pass shows a brief green glow over the player
  and it's gone within a second; grading Fail shows red/pink the same way;
  rapidly failing then passing in quick succession shows a clean fail-then-
  pass flash with no stuck or overlapping glow; the flash never appears on a
  no-op click while `reviewing` is true or on a failed `/api/study/review`
  request; `CardPreviewModal` (`/cards`, `/decks` Preview) is visually
  unaffected.

## Verify
On `/study`, grade a due card Pass and confirm a brief green glow appears
around the player and fades out on its own. Grade the next one Fail and
confirm the same in red/pink. Grade several cards back-to-back quickly and
confirm the flash never gets stuck on-screen or shows the wrong color for the
latest grade. Open a card's Preview from `/cards` or `/decks` and confirm no
flash-related change there. `bun run build` should stay clean; no logic
changes here, so no new unit test (UI-only, per `coding-standards.md`'s
testing scope rule).

## Evidence

Verified against the running dev server via direct CDP automation (navigate,
reveal, grade, poll/screenshot).

Polling `.grade-flash`'s presence and computed `opacity` every 60ms right
after a Pass click:

| t (ms) | state |
|---|---|
| 0 | absent |
| 60 | present, opacity 0.26 |
| 120 | present, opacity 0.96 (peak) |
| 180-480 | present, fading (0.80 -> 0.03) |
| 540+ | absent |

Confirms the overlay appears immediately, peaks near the keyframe's 20% mark,
fades smoothly, and fully clears itself (removed from the DOM, not just
invisible) within the ~500ms budget - no stuck or lingering glow.

Screenshots: a green `box-shadow` ring around the player pane on Pass, and a
red/pink ring on Fail, both matching `var(--pass)`/`var(--fail)`. The
background's independent red ambient glow (feature 14, sampled from the
card's cover art) is visible in the same shots and confirmed unrelated - it
was present before and after the flash, unaffected by grading.

`bun run build` and `bun run test` (35/35) both passed clean on this branch
after the change. No logic was added, so no new unit test - UI-only per
`coding-standards.md`'s testing scope rule.
