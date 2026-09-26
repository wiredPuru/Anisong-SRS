# Feature: Answer feedback

**From build-plan:** feature 84d (parent 84, Kai mascot overhaul)
**Status:** verified

## Goal

Let Kai react to every answer on Study the way her sheet does: a cheering
CORRECT!, a slumped WRONG..., a thinking GUESS? while a typed round is open,
and a "Nice Guess!" when bonus points land. Presentation only: grading,
points, combo, scheduling, and what is announced to screen readers keep their
meaning.

## Design reference

- `blueprint/reference/mascot-v2/kai-sheet-transparent.png`: the CORRECT!
  banner (pink lettering on cream, pink outline, yellow stars), WRONG... (navy
  lettering on periwinkle, blue scribble), GUESS? (brown lettering on cream,
  pink outline), and "Nice Guess!" (tilted pink lettering with stars).
- Poses from 84a (`cheer`, `slump`, `think`), tokens from 84b.

## In scope

- **`.kai-banner`** global classes in `main.css` (`-pass`, `-fail`,
  `-neutral`): chunky display lettering in an outlined rounded banner, so the
  result panel, the grade sticker, and 84e can share one look.
- **`StudyQuizResult`**: Kai replaces the check/exclamation circle (`cheer`
  on pass, `slump` on a wrong pick, `think` when nothing was picked); the
  heading becomes a banner reading "Correct!", "Wrong...", or "Answer
  revealed" (the middle one was "Not quite"). A tilted "Nice Guess!" sticker
  shows when any bonus row scored points. The panel border takes the result
  color at 2px.
- **Manual Pass/Fail** (`submitReview` → `flashGrade`): a `StudyGradeSticker`
  (Kai plus a CORRECT! or WRONG... banner) pops over the player with the
  existing glow and fades out after about 1.1s. `aria-hidden`, since the
  grade is already the user's own button press; `pointer-events: none`.
- **Typed rounds**: a new `guessing` prop on `StudyMediaPlayer` turns the
  playing veil's Kai into the `think` pose with "Guess?" instead of
  "Listening...". Passed from `/study` while Typed Answers is on and no result
  is showing.
- All new motion is off under `prefers-reduced-motion`.

## Out of scope

- Score burst, score chip, and combo effects (feature 67) - unchanged.
- Any change to grading, points, or the review API.

## Build steps

- [x] **Step 1 - Banners + result panel** - *Done when:* a typed round
  answered right shows Kai cheering under a "Correct!" banner, a wrong pick
  shows Kai slumped with "Wrong...", and a round with a scoring bonus shows
  "Nice Guess!" (screenshots, both themes); `bun run build` passes.
- [x] **Step 2 - Grade sticker + Guess? veil** - *Done when:* a manual Pass
  shows the CORRECT! sticker over the player and a Fail shows WRONG...
  (screenshot captured within the 1.1s window); with Typed Answers on and the
  clip playing, the veil reads "Guess?" with Kai thinking and does not overlap
  the answer box at 1400x900 (measured); `bun run test` and `bun run build`
  pass.

## Testing

Presentation only; heading and pose choice are one-line conditionals on data
the existing tests already cover. Evidence is screenshots, a measure, and the
build.

## Evidence

- `bun run test`: 82 files, 1289 tests passed. `bun run build` passed.
- Typed rounds on `/study` (production build, `playwright-cli`): a wrong
  pick showed Kai slumped under a "Wrong..." banner; a right pick showed Kai
  cheering with stars under "Correct!"; a right pick plus a right OP/ED bonus
  (+50) also showed the tilted "Nice Guess!" sticker. The first CORRECT! banner
  clipped the panel's right edge at 1400px, so its size dropped to
  `clamp(18px, 1.9vw, 26px)` and it may wrap.
- Guess? veil: with Typed Answers on, Hide Video on, and the clip playing,
  the veil read "Guess?" with Kai thinking; Kai's bottom at 418px, answer
  stack top at 452px, no overlap (1400x900).
- Manual Pass and Fail showed the CORRECT! and WRONG... stickers over the
  player (screenshots at +350ms, light and dark).
- Found and fixed while checking:
  - With Typed Answers on, the veil content (including a failed clip's
    message and retry buttons, a pre-existing problem) sat under the answer
    box. A typed round now raises the veil content to the frame's top
    (`.veil.raised`) and drops the error Kai there to save room.
  - The sticker stacked on the next card's "Ready?" Kai, so the page now
    passes `hide-listening-label` while the sticker shows.
- Test data: the first rounds ran against the real database and recorded
  three reviews (review_log ids 1512-1514: card 493 fail, cards 436 and 472
  pass, all staying in box 1), reported to the user. Every later check ran on
  a scratch copy (`GAQ_SRS_DATA_DIR`).
