# Fix: one consistent, livelier pass/fail moment on Study

**Type:** Fix
**Status:** verified
**Fixes:** none (not from a findings-ledger entry)

## The problem

When a Study round is graded, three unrelated things signal pass or fail, and
none of them lines up with the others:

1. **A stray glow rectangle.** `.grade-flash` in `app/pages/study/index.vue` is
   an absolutely positioned box (`inset: 12px`, rounded, coloured `box-shadow`)
   that pulses for 500ms. It is sized to the player pane, not to the player
   card, so it shows up as an off-register rectangle behind the card. This is
   the "random rectangle".
2. **Kai's sticker** (`StudyGradeSticker.vue`) pops over the player for 1.1s
   with its own motion, separate from the glow.
3. **The Now playing bar turns green or red** (`StudyNowPlaying.vue`,
   `.now-playing.result-pass` / `.result-fail`: tinted fill and border). It is
   the only signal that stays, but it recolours a large bar for a one-word fact.

The same three fire for manual Pass/Fail and for typed answers
(`flashGrade` is called from both paths), so the problem is the design, not a
single path. A wrong answer also has no motion of its own beyond a slump.

## The fix

Replace the glow rectangle and the bar tint with one **grade moment** that
plays the same way every time, plus a small **result badge** that stays.

**1. Grade moment** (new `StudyGradeMoment.vue`, replaces the `.grade-flash`
div and the bare sticker in the player pane; Kai's pose and banner from the
sticker are kept inside it):
- **Rings, not a box.** One or two circular rings expand from the centre of
  the player and fade, in `--pass` for a pass and `--fail` for a fail. A circle
  has no edges to misalign with the card.
- **Particles from the same spot.** A pass bursts outward: stars and notes in
  `--star`, `--note` and `--pass`. A fail is the quiet mirror image: soft
  droplets in `--fail` that drift down and fade. Same count, same origin,
  same timing, so the two read as one system with two moods.
- **Kai and the banner** ("Correct!" / "Wrong...") sit in the middle of the
  rings, popping on the same beat. A fail still droops; a pass bounces.
- Pure CSS animation, deterministic particle layout (no randomness, so it
  looks the same each time and can be tested). The moment never takes a click
  and is removed on a timer, as the sticker is today; the timer goes from
  1100ms to about 1400ms to fit the longer motion.
- Under `prefers-reduced-motion`: no rings or particles, only the existing
  fade of Kai and the banner.
- Used for both manual and typed grades, via the existing `gradeFlash` state.

**2. Result badge instead of the bar tint** (`StudyNowPlaying.vue`):
- Drop the green/red fill and border on the bar. The bar keeps its normal look.
- Add a round badge on the cover tile (check for pass, cross for fail, in
  `--pass` / `--fail`) that pops in with the moment and **stays until the next
  card**, so the outcome is still readable after the animation ends. The
  per-category pills in the typed result row are unchanged.
- This follows the "disregard the green bar" option. If you miss a tint, the
  badge colour or a thin top-edge line on the bar are the places to add it
  back; say so and I will.

**Must not break**
- Grading, scoring, scheduling, the `+N` score burst, combo shake, and the
  typed result row. Presentation only.
- The player itself, the ambient glow, Listen mode (it has no grading), and
  the party screens.
- `prefers-reduced-motion` stays respected.

## Build steps

- [x] **1. Grade moment.** Add `app/utils/gradeParticles.ts` (pure: the angle,
  distance, delay and shape of each particle for a pass or a fail) with
  `gradeParticles.test.ts`; add `StudyGradeMoment.vue` (rings, particles, Kai
  and banner); in `study/index.vue` swap the `.grade-flash` div and
  `StudyGradeSticker` for it, delete the `.grade-flash` CSS and its keyframes,
  and raise `GRADE_STICKER_MS`; remove `StudyGradeSticker.vue` if nothing else
  uses it.
  *Done when:* grading a card, by Pass/Fail or by a typed answer, shows
  circular rings and the matching burst (stars for a pass, falling droplets for
  a fail) centred on the player with Kai and the banner, no rectangle appears
  anywhere, the new test passes, and `bun run test` and `bun run build` pass.
- [x] **2. Result badge, no bar tint.** In `StudyNowPlaying.vue` remove the
  `.result-pass` / `.result-fail` fill and border and add the persistent
  badge on the cover tile with a short pop-in.
  *Done when:* after a pass or fail the bar looks the same as before grading
  apart from a check or cross badge on the cover that stays until the next
  card; with no cover image the badge still shows; `bun run test` and
  `bun run build` pass.

## Verify

- Run the app against a **copy** of the database (so grading does not move any
  real card's schedule): `GAQ_SRS_DATA_DIR` pointing at a backup, dev server on
  a spare port. Do not grade cards in the real library.
- On `/study`, answer with Pass and with Fail (and once with Typed Answers on):
  capture frames shortly after each click. Expect rings plus the burst, Kai and
  the banner, no rectangle, then only the badge left on the bar.
- Repeat in both themes (Settings > Appearance) and with reduced motion on.
- Confirm Listen and the party screens look unchanged.
