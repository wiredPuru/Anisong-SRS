# Feature 67 design reference - dynamic scoring feedback

`motion-mockup.html` is a throwaway, standalone motion study for feature 67.
Open it directly in a browser (no dev server, no build step) and use the
control strip to fire results.

Motion is the thing being specified here, so a static screenshot cannot serve
as the reference the way `cute-moe-soft-retheme/` did for feature 62. This file
is the reference instead: it carries the real `main.css` token values and the
real point formula from `app/utils/quizScore.ts`
(`100 + min(combo, 4) * 25` for the anime answer, a flat `50` per bonus
category), so timings and colors can be judged against what actually ships.

## What it shows

| Control | What it demonstrates |
|---|---|
| Correct | The `+N` burst popping at the answer box, holding, then flying into the score chip, which pulses and counts up |
| Wrong | The `Miss` burst that drifts and fades in place, plus the combo-lost shake on the chip |
| Run a 5-streak | Escalating combo emphasis as the multiplier climbs |
| Bonus categories on | Bonus chips arriving staggered after the main burst, and the result panel's rows sliding in one at a time |
| Intensity | Three candidate settings - Subtle, Standard, Casino - differing in hold time, pop scale, spark count, and when the frame shake starts |
| Simulate reduced motion | The `prefers-reduced-motion` path: values still update, nothing travels |

## Status

The chosen intensity is recorded in the feature spec. The mockup is discarded
at `/complete`, like `prototypes/` was.
