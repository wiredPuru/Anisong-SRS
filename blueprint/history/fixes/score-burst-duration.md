# Current Feature

## Title

Score burst numbers on Study disappear too fast

## Type

Fix

## Status

verified

## The problem

On `/study` with Typed Answers on, a graded answer's score feedback
(`StudyScoreBurst.vue`, feature 67) pops the "+N" points burst, the "Miss"/
"Revealed" label, and the bonus/combo tags, then either flies them into the
score chip or fades them in place. `HOLD_MS` (`app/components/study/StudyScoreBurst.vue`)
is `460`ms - the time a burst sits still and readable before it starts
travelling or fading. At that length the number is gone before it's fully
read, especially the points burst players actually care about.

## The fix

Increase `HOLD_MS` from `460` to `1600` (+1140ms, within the requested 1-2
second range) so every burst - points, miss/revealed, combo, combo lost, and
bonus - holds noticeably longer before it travels or fades. `TRAVEL_MS`
(520ms) and the bonus stagger/delay constants in `app/utils/scoreBurst.ts`
are untouched, so the relative choreography (combo tag following the points
burst, bonuses staggering in) is unaffected - everything just starts later
and the on-screen number itself reads for longer. No change to point values,
grading, or the `landed` event contract (`StudyQuizScore.vue`'s count-up
still fires when a travelling burst arrives, just later).

Must not break: `prefers-reduced-motion`'s early-return path in `launch()`
(unaffected, doesn't use `HOLD_MS`), or the stacked vertical offsets for
combo/bonus bursts.

## Build steps

1. [x] Change `HOLD_MS` from `460` to `1600` in `app/components/study/StudyScoreBurst.vue`.
   Done when: a passed typed-answer guess on `/study` shows the "+N" burst
   noticeably longer (about 1.1s more) before it flies into the score chip,
   and a failed/bonus burst likewise holds longer before fading, with no
   layout or console errors.

## Verify

Run `bun run dev`, enable Typed Answers on `/study`, answer a card correctly
and incorrectly, and confirm the burst now stays visible for roughly 2
seconds before animating away instead of about 1. No test needed - this is a
pure timing-constant change with no branching logic to assert against.
