# Fix: Scrub bar grows on hover (and while dragging)

**Type:** Fix
**Status:** verified

## The problem

The scrub bar (`.scrub` in `StudyMediaPlayer.vue`) is a thin 7px-tall
strip - precise, but small enough to make hovering and grabbing it
harder than it needs to be. The user asked for a "macOS Dock"-style
grow-on-hover effect, clarified to mean a simple uniform grow (the whole
bar gets taller on hover, like YouTube/Netflix scrub bars), not a literal
cursor-proximity magnification curve.

## The fix

- `.scrub`: add a `height` transition, and grow it on `:hover` (7px →
  12px). Confirmed safe from layout shift: `.player-controls` is a flex
  row whose cross-axis size is dominated by the 48px `.play-btn`, not the
  7px scrub bar, so growing the scrub bar's height doesn't move the play
  button or the time text - it just re-centers within space that's
  already there.
- Also grow it while **actively dragging**, not just on CSS `:hover` -
  the existing drag tracking (feature: scrub-bar-drag-tracking) uses
  `window`-level `mousemove`, so the cursor can leave `.scrub`'s bounds
  mid-drag; if the grow were pure `:hover`, the bar would shrink back
  while still being dragged, which would look broken. Add a reactive
  `isDragging` ref, set `true` in `onScrubMouseDown` and `false` in its
  `mouseup` handler, and bind a `dragging` class on `.scrub` that applies
  the same grown height as `:hover`.

**Must not break:** the existing drag-tracking behavior (`onScrubMouseDown`
/ `seekToClientX` / the `mouseup` cleanup and `onUnmounted` safety net) -
this only adds a reactive flag alongside it, no change to the seek math
or event wiring itself.

## Build steps

- [x] **Step 1 - Add the hover/drag grow effect**
  - `nuxt-app/app/components/study/StudyMediaPlayer.vue`:
    - Add `const isDragging = ref(false);` near the other player-state
      refs.
    - In `onScrubMouseDown`, set `isDragging.value = true` at the start;
      in its inner `onMouseUp`, set `isDragging.value = false` alongside
      the existing listener cleanup.
    - Bind `:class="{ dragging: isDragging }"` on the `.scrub` div
      (alongside its existing `@mousedown`).
    - CSS: add `transition: height 0.15s ease;` to `.scrub`, and a
      `.scrub:hover, .scrub.dragging { height: 12px; }` rule.

  *Done when:* hovering the scrub bar (without clicking) smoothly grows
  it from 7px to 12px and back on mouse-leave; starting a drag and moving
  the cursor outside the bar's vertical bounds while still holding the
  mouse keeps it grown, only shrinking back after `mouseup`; the play
  button and time text don't visibly shift when the bar grows; no
  console errors.

## Verify

- No test runner configured; pure CSS + one reactive flag - rides on
  browser evidence.
- Manual check: open `/study`, hover the scrub bar (no click) and confirm
  it grows smoothly; move the mouse away and confirm it shrinks back;
  start a drag, move the cursor above/below the bar while still holding
  the mouse down, and confirm it stays grown until release.
- `bun run build` clean.

Verified via Playwright across 5 states (baseline, hovering, moved away,
dragging with cursor 100px outside the bar's bounds, after mouseup): the
grow/shrink and drag-persistence behaviors all worked exactly as
designed, and the play button/time text's vertical position measured
pixel-identical across every state - zero layout shift. No console
errors.
