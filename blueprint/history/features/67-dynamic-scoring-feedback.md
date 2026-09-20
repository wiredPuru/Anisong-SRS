# Feature: Dynamic scoring feedback on Study

**From build-plan:** feature 67
**Status:** verified

## Goal

Make typed-answer scoring (features 65/66) feel energetic and arcade-like
instead of a number quietly changing in the header. When an answer is graded,
the points burst over the player where the answer was given, travel into the
session score chip, and the chip's total visibly climbs; a growing combo gets
escalating emphasis, and bonus categories arrive one at a time rather than all
at once.

Presentation only. No point value, grade, SRS schedule, or stored shape
changes.

## Design reference

`blueprint/reference/dynamic-scoring-feedback/motion-mockup.html` - a
standalone, throwaway motion study carrying the real `main.css` tokens and the
real point formula. Open it in a browser and use the control strip. Its README
explains each control.

Motion is what is being specified, so a static image cannot serve as the
reference the way `cute-moe-soft-retheme/` did for feature 62; the mockup is
the reference instead. It is discarded at `/complete`.

**Chosen intensity: Standard.** The mockup's three presets differ only in hold
time, pop scale, spark count, and the combo at which the frame shakes:

| Preset | Hold | Travel | Pop scale | Sparks | Frame shake from |
|---|---|---|---|---|---|
| Subtle | 320ms | 420ms | 1.10 | 0 | never |
| **Standard** | **460ms** | **520ms** | **1.22** | **8** | **combo 3** |
| Casino | 620ms | 620ms | 1.38 | 18 | combo 2 |

If the user picks a different preset after watching the mockup, update this
table's bold row and the constants in Step 2 before building; nothing else in
the spec changes.

## In scope

- A fixed, pointer-events-none burst layer over `/study`, rendering only while
  Typed Answers is on.
- The main `+N points` burst for the anime answer: pops at the answer box,
  holds long enough to read, then flies into the session score chip and fades,
  with a short spark scatter at the origin.
- A miss burst for a wrong or given-up answer: drifts and fades in place, no
  travel, plus a `Combo lost` tag and a chip shake when a streak actually
  broke. Wording follows the result panel's own distinction - `Miss` when an
  answer was submitted and wrong, `Revealed` when the user gave up, since
  giving up is a choice rather than a failure to name.
- Escalating combo emphasis: a `Nx combo` tag from combo 2, and a short player
  frame shake from combo 3.
- `StudyQuizScore`'s total counting up to its new value with a landing pulse,
  timed to when the burst arrives rather than the instant grading finishes.
- Bonus categories (66a/66b) bursting staggered, one after the other, after
  the main burst, each adding to the count-up as it lands - on a failed anime
  answer too, since a bonus category is graded independently and can score
  while the anime guess misses.
- `StudyQuizResult`'s existing bonus rows animating in staggered instead of
  all at once.
- A full `prefers-reduced-motion` path: every value still updates immediately
  and correctly, nothing travels, pops, shakes, or sparkles.

## Out of scope

- Any change to `app/utils/quizScore.ts`'s point values or grading, to SRS
  scheduling, or to `ReviewLog` / stats.
- Sound. No audio feedback of any kind; the card's clip is playing and must
  not be competed with.
- The same feedback in `CardPreviewModal`. Preview has no quiz state to score.
- Manual Pass/Fail (Typed Answers off). That path keeps today's `gradeFlash`
  exactly as it is; it has no score to burst.
- A settings toggle for intensity. One shipped feel, matching how feature 45's
  visualizer has no toggle of its own.
- Persisting anything. All of this is session-only, like the score itself.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - burst plan logic + tests** - add `app/utils/scoreBurst.ts`:
  a pure `buildBurstPlan(grade)` that turns one graded answer (result, whether
  an answer was submitted or given up, points awarded, combo, bonus results)
  into an ordered list of burst descriptors (`kind`, `label`, `points`,
  `delayMs`, `travels`), and a pure `burstTravel(from, to)` returning the
  `{ dx, dy }` a burst animates along. Both take plain
  `{ left, top, width, height }` objects, not live `DOMRect`s, so the tests
  need no DOM. Reduced motion is handled by callers, not baked in here. No
  component changes, nothing rendered yet. *Done when:* `bun run test` is
  green with a new `app/utils/scoreBurst.test.ts` covering a pass with no
  bonuses, a pass with two bonuses (delays strictly ascending, main burst
  first), a fail with a broken combo, a fail with no prior combo (no
  `comboLost` descriptor), a give-up (`Revealed`, not `Miss`), a fail whose
  bonus still scored, and `burstTravel` against two known rects; `/study` is
  visibly unchanged.

- [x] **Step 2 - burst layer + the main `+N`** - add
  `app/components/study/StudyScoreBurst.vue`: a `position: fixed`,
  `pointer-events: none`, `aria-hidden` layer that exposes
  `launch(plan, { origin, targetEl })` and animates each descriptor with the
  Web Animations API. Add a `--z-score-burst: 40` token to `main.css` (above
  `--z-chrome`, below `--z-modal`, so the session log and Preview still cover
  it). Wire only the main anime-answer burst from `saveTypedAnswer` in
  `study/index.vue`, targeting the `StudyQuizScore` chip.

  **Ordering trap, and the reason `origin` is a rect rather than an element:**
  the answer stack renders under `v-if="typedAnswers && !quizResult"`, so
  setting `quizResult` unmounts the very element the burst should fly from.
  Read the origin rect *before* writing `quizResult.value`, and fall back to
  the player frame's centre if the stack is somehow already gone.

  *Done when:* with Typed Answers on, a correct answer shows `+125 pts` pop
  where the answer box was, hold, then fly into the score chip and vanish; a
  screenshot mid-flight shows it over the player, not clipped by the pane;
  nothing renders with Typed Answers off.

- [x] **Step 3 - chip count-up + landing pulse** - `StudyQuizScore.vue`
  animates its displayed total from the old value to the new one over ~480ms
  on a `requestAnimationFrame` tween, driven by the burst landing rather than
  by the prop changing, plus the landing pulse on arrival. *Done when:* a
  correct answer leaves the chip total climbing to its new value as the burst
  arrives, not snapping the instant the answer is graded; the chip pulses
  once on arrival; the `aria-label` reports the final total, not an
  intermediate one.

- [x] **Step 4 - combo emphasis + the miss burst** - add the `Nx combo` tag
  (combo 2+), the player frame shake (combo 3+), the miss burst that drifts in
  place with no travel, and the `Combo lost` tag plus chip shake when a streak
  actually broke. *Done when:* a 3-answer streak shows a combo tag from the
  second correct answer and a frame shake from the third; a wrong answer after
  a streak shows `Miss`, `Combo lost`, and the chip shake; a wrong answer with
  no streak shows `Miss` alone; a give-up shows `Revealed`.

- [x] **Step 5 - staggered bonuses + result rows** - launch the bonus bursts
  on the delays Step 1 computes, each folding into the count-up as it lands,
  on both a passed and a failed anime answer. Stagger `StudyQuizResult`'s
  existing `.bonus-row` entries with a per-row `animation-delay`. *Done when:*
  with both bonus categories on, a correct answer shows the main burst, then
  `+50 song name`, then `+50 opening/ending` arriving in sequence, the chip
  total climbing three separate times, and the result panel's rows sliding in
  one at a time; a wrong anime answer with a correct bonus still bursts that
  bonus.

- [x] **Step 6 - reduced motion, cancellation, and narrow windows** - honour
  `prefers-reduced-motion: reduce` (via `matchMedia`, not only CSS, since the
  travel is scripted): scores and rows update instantly with no burst, no
  shake, no sparks. Cancel every pending burst, animation, and timer on
  Continue, presentation change, scope change, and unmount, snapping the
  count-up to its final value rather than abandoning it mid-tween. *Done
  when:* with reduced motion forced in devtools, a full correct-with-bonuses
  answer updates every number correctly with nothing flying; pressing Continue
  immediately after answering leaves no burst on screen, no stray node in the
  burst layer, and the chip showing the correct total; at 700px wide the burst
  still lands on the wrapped chip; `bun run build` and `bun run test` pass.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/app/utils/scoreBurst.ts` | new - pure burst-plan and travel logic |
| `nuxt-app/app/utils/scoreBurst.test.ts` | new - the logic gate for Step 1 |
| `nuxt-app/app/components/study/StudyScoreBurst.vue` | new - the overlay layer |
| `nuxt-app/app/components/study/StudyQuizScore.vue` | count-up, landing pulse, combo emphasis, shake |
| `nuxt-app/app/components/study/StudyQuizResult.vue` | staggered bonus rows only |
| `nuxt-app/app/pages/study/index.vue` | launch bursts from `saveTypedAnswer`; refs for origin/target; cancellation |
| `nuxt-app/app/assets/css/main.css` | `--z-score-burst: 40` |

## Data / contracts

No schema, route, or API change. No change to `CardWithDetails`, `QuizScore`,
`QuizResultPhase`, or `BonusCategoryResult`.

One new client-only shape, in `app/utils/scoreBurst.ts`:

```ts
export type ScoreBurstKind = "points" | "miss" | "combo" | "comboLost" | "bonus";

export interface ScoreBurst {
  id: number;          // unique per launch, so a re-grade can't reuse a node
  kind: ScoreBurstKind;
  label: string;       // rendered text, e.g. "+125", "3x combo", "Miss"
  points: number;      // 0 for non-scoring bursts
  delayMs: number;     // from launch; the stagger lives here, not in the component
  travels: boolean;    // true flies to the score chip, false fades in place
}
```

Not load-bearing for a later feature - it exists only between
`study/index.vue` and `StudyScoreBurst.vue`. Keep `points` on it anyway: it is
what lets the chip's count-up be driven by arrivals rather than by one lump
prop change.

## Testing

The test gate is **on** (`bun run test`, Vitest - see Commands in `AGENTS.md`).

- **In-scope logic, tested in Step 1:** `buildBurstPlan` and `burstTravel` in
  `app/utils/scoreBurst.ts`. Both are pure, with real edge cases (no bonuses,
  a fail with no prior combo, delay ordering). `app/utils/quizScore.test.ts`
  must stay green and unmodified - if it needs a change, scoring moved and
  this feature has drifted out of scope.
- **Not unit tested:** `StudyScoreBurst.vue`, the chip count-up, and the
  result-panel stagger. These are animation and rendering, verified with
  browser evidence per the Browser Verification section of
  `coding-standards.md`. Playwright is deliberately not a dependency; use the
  dev server plus screenshots, and `bun run measure` if a layout question
  comes up.
- **Manual path per step:** start `bun run dev`, go to `/study`, turn Typed
  Answers on in the display toggles, and answer cards. Steps 3 and 4 need a
  streak, so answer several correctly in a row; Step 4 needs Song name and
  Opening/Ending enabled in the categories menu.
- **Final gate:** `bun run test` and `bun run build` both green before
  `/complete`.

## Notes for the AI

- **Client-only.** Nothing here touches `server/`. No route is added or
  changed.
- **Measure at launch, never cache rects.** The header wraps below 820px and
  the chip's position depends on the scope chip and new-card chip's widths.
  Read the target rect inside `launch()`, and the origin rect at the call
  site just before `quizResult` is set (see Step 2's ordering trap).
- **Animate with the Web Animations API, not CSS classes,** for anything whose
  distance depends on a measured position. CSS keyframes are fine for the
  in-place pulses, shakes, and row stagger. This is the split the mockup uses.
- **Never block or delay grading.** The burst is fire-and-forget decoration:
  `quizScore`, `quizResult`, and `sessionHistory` must be written exactly when
  they are today. If the layer throws, the grade still lands.
- **Cancel on every exit.** `presentationKey` and `scope` watchers already
  reset quiz state in `study/index.vue`; hook cancellation into the same
  place, and clear timers in `onUnmounted` the way `gradeFlashTimeout` already
  does.
- **Don't announce twice.** `StudyQuizResult` is already `role="status"`
  `aria-live="polite"`. The burst layer is `aria-hidden="true"`, and
  `StudyQuizScore`'s `aria-label` keeps reporting the final value, not the
  in-flight tween.
- **Leave `gradeFlash` alone.** The existing pass/fail glow on the player pane
  serves manual review too and is out of scope.
- **Tokens only.** Every colour comes from `main.css` (`--pass`, `--fail`,
  `--warning`, `--accent-secondary`), per feature 62b's sweep - no literals in
  components.
- **No em dashes** in any code comment, commit message, or doc, per the
  Writing section of `coding-standards.md`.
