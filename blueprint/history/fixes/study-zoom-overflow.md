# Fix: Prevent Study UI overflow when zoomed

**Type:** Fix

**Status:** verified

## The problem

On `/study` with Typed Answers enabled, browser zoom can reduce the effective
space enough that two quiz surfaces stop fitting. The revealed-result card can
shrink vertically inside the side column while its hidden overflow clips the
correct answer and remaining actions past the card border. The header score pill
can also keep all of its stats on one line after the available width becomes too
small, causing labels and values to overlap or escape their container.

## The fix

Make `StudyQuizResult` and `StudyQuizScore` respond to the space their Study
containers actually provide. The result card must retain enough height for its
content and use the side pane's existing scrolling when the viewport is short.
The score pill must compact, wrap, or progressively omit secondary presentation
before any stat collides, while preserving the score information and accessible
label. Keep the normal desktop layout, Typed Answers grading behavior, header
controls, and narrow single-column Study layout unchanged.

## Build steps

- [x] **Step 1 - Make quiz feedback resilient to reduced zoom space.** Adjust
  the result card's flex and overflow behavior and give the score pill responsive
  sizing rules based on available space. Cover long anime titles and wider score,
  combo, and correct-count values without fixed clipping assumptions. **Done
  when:** at normal size and representative 150% and 200% browser zoom levels,
  every result-card field and action remains inside its border or reachable by
  the existing side-pane scroll; score stats never overlap or cross the pill;
  and the page gains no unintended horizontal scrollbar.

## Verify

- Run `bun run test` and `bun run build` from `nuxt-app/`, then run
  `git diff --check` from the repository root.
- On `/study`, enable Typed Answers, submit or give up, and inspect the result
  phase at 100%, 150%, and 200% browser zoom with both a tall and short window.
- Confirm the result heading, selected answer when present, correct answer,
  points, total, combo, listening hint, and Continue button remain contained and
  reachable, including with a long title.
- Before and after revealing an answer, confirm Score, Combo, and Correct remain
  legible within the header pill with larger numeric values and do not collide
  with the deck counts, progress bar, display toggles, or session-log button.
- Check the existing narrow single-column Study layout and normal desktop layout
  for horizontal page scrolling, clipped borders, or regressions in controls.
