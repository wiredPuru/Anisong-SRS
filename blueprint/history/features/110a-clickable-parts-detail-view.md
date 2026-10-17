# Feature: Clickable parts + detail view (110a)

**From build-plan:** feature 110, sub-feature 110a
**Status:** verified

## Goal

In the Japanese breakdown panel (feature 109), make every kanji tile and every
part chip clickable. A click opens an inline detail view for that character:
large glyph, keyword and alternates, readings, strokes, RTK frame, and its own
parts as further clickable chips. Drilling from 魔 into 鬼 and back is the point,
so the user can study each primitive and build their own stories (110b stores
them). Parts are KRADFILE's flat decomposition, so drilling shows the clicked
character's own parts, not a nested tree.

## In scope

- Tiles in `StudyJapaneseBreakdown.vue` become buttons that open the detail.
- Part chips (`.jb-part`) become buttons that open the detail for that part.
- Inline detail view replaces the title sections inside the panel (no modal),
  with a Back button and a trail of the characters drilled through.
- A part with no dictionary entry (`ノ ハ ｜ ユ ヨ マ`) opens a short "bare
  stroke shape, no entry" detail instead of failing.
- Works on Study and Listen (same component). Blurred and inert while Hide Info
  hides the answer, exactly as the panel is today.
- Drill state resets when the card changes.

## Out of scope

- Storing or editing stories (110b).
- Nested decomposition, stroke-order animation, or any new data (the existing
  `GET /api/kanji` is reused unchanged).
- Changing the script switch, the J hotkey, or the Settings toggle.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Drill-stack helpers + tests** - pure functions in
  `app/utils/japaneseBreakdown.ts`: `openKanji(stack, char)` (push; opening the
  character already on top is a no-op), `backKanji(stack)` (pop, never below
  empty), and (the trail shows the stack as is, so no trail helper). *Done when:* the new
  cases in `japaneseBreakdown.test.ts` pass under `bun run test` (push, repeat
  top, back to empty, back on empty).
- [x] **Step 2 - `StudyKanjiDetail.vue`** - new component in
  `app/components/study/`: props `char`; fetches `/api/kanji?text=<char>`
  (browser-cached for a day by the route), shows glyph, keyword, alternates,
  parts as buttons emitting `open`, on/kun readings, strokes, RTK frame; Back
  button emitting `back`; loading, error (with retry) and no-entry states.
  Reuses the existing tile formatters. *Done when:* mounted with 魔 it lists its
  eight parts as buttons; with `ノ` it shows the no-entry note; a failed fetch
  shows an error and a working retry.
- [x] **Step 3 - Wire into the panel** - tiles and part chips become buttons that
  call `openKanji`; the panel shows `StudyKanjiDetail` for the top of the stack
  instead of the title sections, with Back and a trail; the stack resets on a
  card/title change and when the panel is blurred. Buttons are keyboard
  reachable and have visible focus. *Done when* (browser, Study and Listen): click
  魔's tile, then 鬼, then Back twice returns to the title view; changing card
  resets it; with Hide Info on the panel stays blurred and unclickable; no
  console errors.

## Files / areas

- `nuxt-app/app/utils/japaneseBreakdown.ts` (+ `.test.ts`)
- `nuxt-app/app/components/study/StudyKanjiDetail.vue` (new)
- `nuxt-app/app/components/study/StudyJapaneseBreakdown.vue`

## Data / contracts

- No schema, route, or stored-shape change. `KanjiEntry` (client copy in the
  panel) is reused as is; the detail component should share it rather than
  declare a third copy, keeping field order matching `server/utils/kanjiData.ts`.
- Load-bearing for 110b: the detail component takes a single `char` and is the
  one place a story box will be added.

## Testing

- Test runner configured: Step 1's pure helpers ship tests in the same diff.
- Steps 2-3 are UI: verify with the dev server in a browser (screenshot, console
  clean) on `/study` and `/listen`, plus `bun run build`.
- Edge cases to hit by hand: a kanji with no keyword, a part with no entry, a
  title with no kanji, switching script while a detail is open, card change
  mid-drill.

## Notes for the AI

- Scoped styles with `var(--token)`, no inline styles, no hard-coded colors.
- Japanese stays real selectable DOM text with `lang="ja"`.
- Don't intercept Esc or Space (hotkey registry owns them); Back is a button.
- No em dashes in comments or copy.

**Built as:** `openKanji`\/`backKanji` (`app/utils/japaneseBreakdown.ts`), `StudyKanjiDetail.vue`, and the panel wiring; a character is filtered out of its own parts (KRADFILE lists primitives as their own part). Verified: `bun run test` (2524 passed), `bun run build`, and measure screenshots on `/listen` (魔 then 鬼, Back).
