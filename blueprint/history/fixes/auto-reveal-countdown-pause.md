# Current Feature

## Auto Reveal countdown keeps ticking while paused

**Type:** Fix

**Status:** verified

## The problem

On `/study` with Auto Reveal on, pausing playback pauses the real reveal timer
but not the "Revealing in N" pill on the info panel. The pill keeps counting
down to 0 while paused, and the info only reveals once the clip has actually
played for the full interval, so the number on screen and the reveal disagree.

Root cause: there are two independent clocks.

- `pages/study/index.vue` owns the real timer (`startAutoRevealTimeout`,
  `onPlaybackPaused`, `autoRevealRemainingMs`), which pauses and resumes with
  playback correctly (feature 46's fix).
- `components/study/StudyAutoRevealCountdown.vue` runs its own
  `setInterval`, seeded once from `seconds` in `onMounted`, and knows nothing
  about pause. `currentAutoRevealRemainingSeconds()` is only read at mount, so
  it cannot re-sync the pill later.

## The fix

Make the page's timer the single source of truth for the displayed number.

- In `study/index.vue`, hold the remaining seconds in a reactive ref, updated
  by a short display tick (for example every 250ms) only while the reveal
  timeout is armed, computed from `autoRevealArmedAt`/`autoRevealArmedDurationMs`
  the same way `currentAutoRevealRemainingSeconds()` already does. Stop the
  tick on pause, reveal, card change, mode off, and unmount; set the ref from
  `autoRevealRemainingMs` on pause and from `autoRevealSeconds` when not
  started.
- Make `StudyAutoRevealCountdown.vue` purely presentational: render the
  `seconds` prop, delete its own interval and `onMounted`/`onUnmounted`.
- Extract the ceil/clamp math into a small pure helper (for example
  `app/utils/autoReveal.ts`) with a Vitest test beside it, and reuse it in the
  page.

Must not break:

- Pause/resume continuing from the remaining time, not restarting.
- Early manual reveal (`i`, Hide toggles, reveal button) stopping the countdown.
- Mode/interval changes after a card revealed not re-hiding it.
- Countdown starting on the `playing` event, not `play` (feature 38 fix).

## Build steps

- [x] **1. Drive the pill from the page timer.** Add the pure remaining-seconds
  helper and its test, add the reactive remaining-seconds ref and display tick
  in `study/index.vue`, and strip `StudyAutoRevealCountdown.vue` down to
  rendering its prop.
  **Done when:** pausing mid-countdown freezes the pill on its current number,
  resuming continues from that number, and the info reveals the moment the
  pill reaches 0; `bun run test` and `bun run build` pass.

## Verify

1. Settings popup: Auto Reveal mode Info, 10 seconds. Start a card on `/study`.
2. Let it reach about 6, press `s` to pause. Wait 10+ seconds: the pill stays
   at 6 and the info stays hidden.
3. Press `s` to resume: the pill continues 6, 5, 4... and the info reveals as
   it hits 0.
4. Pause and resume several times in one card; the total played time before
   reveal still matches the interval.
5. Press `i` mid-countdown: the pill disappears and info shows. Next card
   re-arms from the full interval.
