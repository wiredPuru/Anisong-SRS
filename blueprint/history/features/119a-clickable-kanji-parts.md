# Feature: Clickable parts on /kanji (119a)

**From build-plan:** feature 119a (sub-feature of 119, "Explore kanji parts on /kanji")
**Status:** verified (tests, build, browser run via playwright-cli at 1280x720)

## Goal

After Reveal on `/kanji`, each part (for example 化 and 艾 under 花) is a button.
Clicking one opens that character's detail view in place of the card's content,
showing its keyword, readings, strokes, RTK frame, its own clickable parts, your
story and Add to Kanji Study, so an unknown part can be drilled down to its
pieces. Back returns, one level at a time, to the card with its reveal intact.

## In scope

- The parts row on the `/kanji` card (`.kanji-parts`) becomes buttons.
- A drill stack on the page, using `openKanji` / `backKanji` from
  `app/utils/japaneseBreakdown.ts`. While it is non-empty the page shows
  `StudyKanjiDetail` for the top of the stack instead of the kanji card.
- The same marks the breakdown uses on parts: a dot for "has your story" and a
  border for "in Kanji Study" (`storyChars` from `GET /api/kanji/story/chars`,
  `useKanjiDeck`), with `storyChanged` keeping the story set current.
- Keyboard: while the detail view is open, Space, Enter and the arrows do
  nothing (so a keypress cannot grade the card behind it); Escape goes back.

## Out of scope

- The search box (119b).
- Opening the main kanji itself in the detail view, and any change to
  `StudyKanjiDetail`, the story editor, or Add to Kanji Study behaviour.
- A source card for a kanji added from a part (none is passed, so it plays
  random clips, as feature 113 decided).
- Any server, schema or API change.

## Decisions made in this spec

- **Replace, don't overlay.** The detail view takes the card's place (the clip
  column and header stay), so the viewport fit from the earlier fix holds.
- **Back keeps state.** The card stays mounted-by-state: `revealed`, the story
  editor and the clip are untouched while drilling, since none of that lives in
  the stack.
- **Moving to the next kanji clears the stack.** It cannot normally change while
  drilling (grading is disabled), but a reload of the queue resets it too.
- **Part buttons only after Reveal.** The parts are part of the answer, so they
  stay hidden until Reveal, as today.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Drill state and keys** - in `app/utils/kanjiStudy.ts` extend
  `kanjiKeyAction(key, revealed, modifiers, drilling)` so that while `drilling`
  is true it returns `null` for Space, Enter and the arrows and `"back"` for
  Escape (add `"back"` to `KanjiKeyAction`). Unit tests: each key while
  drilling, and unchanged behaviour when not drilling. *Done when:* `bun run
  test` passes.
- [x] **Step 2 - Wire the page** - in `kanji/index.vue` add `drill` (string
  array), `storyChars` and a `storyChanged` handler (as `StudyJapaneseBreakdown`
  does), load `useKanjiDeck`'s deck if not loaded, turn the parts into buttons
  (`@click` pushes `openKanji`), render `StudyKanjiDetail` (`v-else-if` over the
  card) with `@open`, `@back` and `@story-changed`, pass `drilling` and handle
  `"back"` in `onKeydown`, and clear `drill` when the current kanji changes.
  *Done when:* in the browser at 1280x720, revealing 魔 and clicking 鬼 then 田
  shows each detail with Back returning one level, and the final Back shows the
  card still revealed with its story; Add to Kanji Study on a part toggles and
  its chip gets the in-deck border on return; Space and the arrows do nothing
  while a detail is open and Escape goes back; the page does not scroll and the
  console shows no errors.

## Files / areas

- `nuxt-app/app/utils/kanjiStudy.ts` (+ test)
- `nuxt-app/app/pages/kanji/index.vue`
- Reuses `app/components/study/StudyKanjiDetail.vue`, `app/composables/useKanjiDeck.ts`,
  `app/utils/japaneseBreakdown.ts` unchanged.

## Data / contracts

- No schema, route or stored-shape change. `StudyKanjiDetail`'s props and events
  (`char`, `depth`, `storyChars`, optional `sourceCardId`; `open`, `back`,
  `storyChanged`) are used exactly as the breakdown uses them.

## Testing

- Vitest for the new `kanjiKeyAction` behaviour while drilling.
- Step 2 is UI: browser evidence (screenshots of the detail view and back at
  1280x720, console check) plus `bun run build`.

## Notes for the AI

- Mirror `StudyJapaneseBreakdown.vue` (lines around `storyChars`, `onStoryChanged`
  and the `StudyKanjiDetail` usage) rather than inventing new state handling.
- Do not pass `sourceCardId`; a kanji added from here plays random clips.
- The detail view has its own story editor and Add button: do not duplicate them.
- No em dashes in generated text; keep comments to the why.
