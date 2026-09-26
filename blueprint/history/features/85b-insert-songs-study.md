# Feature: Insert songs - Study, grading, and stats

**From build-plan:** feature 85b (parent: 85. Insert songs)
**Status:** verified
**Branch:** `feature/85b-insert-songs-study`

## Goal

Make insert cards first-class wherever a slot is filtered, graded, counted, or
shown. The Study and deck-from-filters Theme filter gains Insert. The OP/ED
number answer gains an "Insert" choice that an insert passes with no number.
`/stats`' OP vs ED split gains an Insert bucket. Every slot label reads
"Insert" instead of the internal `IN-21049`.

## In scope

- Pure slot helpers (`app/utils/themeSlotAnswer.ts`):
  - `ThemeSlotType` gains `"IN"`.
  - `normalizeThemeSlot("IN-21049")` returns `{ type: "IN", number: 0 }`.
  - `formatThemeSlot` renders `IN` as "Insert".
  - `evaluateThemeSlotAnswer` passes any Insert pick against an insert,
    whatever the number.
- `StudyThemeSlotAnswer.vue`: a third "Insert" button. Choosing it disables
  the number field, because an insert has no number.
- Study filters, server and client: `THEME_TYPES` gains `"IN"`, shown as an
  "Inserts" chip. `studyFilterCondition` already matches `like 'IN%'`.
  Deck-from-filters (77) shares the same condition.
- Stats: `ThemeKind` gains `"IN"`, and `classifyThemeSlot` maps an insert slot
  there. `/stats` labels it "Inserts" and, like "other", hides the bucket until
  it has a review.
- Labels: `formatThemeSlotLabel` in `CardTable`, `CardInspector`,
  `StudyInfoPanel`, `StudyMediaPlayer`'s theme badge, `/stats`' leech rows,
  `SettingsLibraryHealth`, and `SettingsLibraryRecover`.

## Out of scope

- **Card edit forms.** The theme-slot text field (feature 16) keeps showing
  the raw stored value. It edits the song's identity, and relabelling it
  would make a save rewrite `IN-21049` to "Insert".
- **Hiding the Insert choice or chip when the library has no inserts.**
  Always showing them is deliberate:
  - Hiding the picker's Insert button per card would give the answer away.
  - Hiding it by the setting would make an insert unanswerable once the
    setting is turned off, and turning it off keeps the insert cards.
- Any change to point values, SRS scheduling, or stored shapes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Slot helpers and grading** - make the `themeSlotAnswer.ts`
  changes listed under In scope. `formatThemeSlotLabel` keeps showing
  non-insert slots raw, so suffixed slots like `ED7-ShounenHen` read as they
  do today. Everything below builds on this. *Done when:* unit tests cover:
  - normalize, format, and evaluate for `IN-21049`;
  - an Insert pick failing against `OP1`, and an `OP1` pick failing against
    an insert;
  - the existing OP/ED cases, unchanged.
- [x] **Step 2 - Insert choice in the OP/ED answer** -
  `StudyThemeSlotAnswer.vue` gains an "Insert" button, and choosing it
  disables the number input. The result panel shows the pick as "Insert"
  through `formatThemeSlot`, and the expected answer for an insert card reads
  "Insert". *Done when:* a screenshot of Study with the OP/ED category on
  shows the three buttons, with the number field disabled after Insert is
  picked. Build and tests pass.
- [x] **Step 3 - Insert in the Theme filter** - add `"IN"` to the server's
  `THEME_TYPES`, to `StudyThemeType`, and to `readStoredFilters`' allowed
  values, plus an "Inserts" chip in `StudyFilterForm`. *Done when:*
  - `studyFilters.test.ts` shows `themeTypes: ["IN"]` parsing and narrowing to
    insert songs (and `["OP","IN"]` to both);
  - `readStoredFilters` keeps `"IN"`;
  - on an isolated library holding one OP card and one insert card,
    `/api/study/next` with `themeTypes: ["IN"]` reports `dueCount` 1.
- [x] **Step 4 - Insert bucket in stats** - `classifyThemeSlot` returns `"IN"`
  for an insert slot, `THEME_KINDS` becomes `OP, ED, IN, other`, and `/stats`
  labels the new bucket "Inserts", hidden while it has no reviews. *Done
  when:* `stats.test.ts` covers the classification and a shaped retention
  with insert reviews.
- [x] **Step 5 - Labels everywhere** - replace each raw `themeSlot` display
  listed under In scope with `formatThemeSlotLabel`. *Done when:* a
  screenshot of the isolated library's `/cards` shows "Insert" in the table
  row and in the inspector, and build and tests pass.

## Files / areas

- `nuxt-app/app/utils/themeSlotAnswer.ts` (+ test)
- `nuxt-app/app/components/study/StudyThemeSlotAnswer.vue`
- `nuxt-app/server/utils/studyFilters.ts` (+ test),
  `app/utils/studyFilters.ts` (+ test), and
  `app/components/study/StudyFilterForm.vue`
- `nuxt-app/server/utils/stats.ts` (+ test) and `app/pages/stats/index.vue`
- `CardTable.vue`, `CardInspector.vue`, `StudyInfoPanel.vue`,
  `StudyMediaPlayer.vue`, `SettingsLibraryHealth.vue`, and
  `SettingsLibraryRecover.vue`

## Data / contracts

- `ThemeSlotType = "OP" | "ED" | "IN"`. An `IN` selection's `number` is
  ignored in grading.
- Study filter `themeTypes` accepts `"IN"`. This changes the `/api/study/next`
  and `/api/decks/filter-preview` inputs, backwards compatibly. A saved filter
  from before 85b still parses.
- Stats `ThemeKind = "OP" | "ED" | "IN" | "other"`. Keep the server and client
  copies in the same order (per F-09's rule).
- No schema or stored-value changes.

## Testing

Vitest is on:

- Step 1: `themeSlotAnswer.test.ts`.
- Step 3: `server/utils/studyFilters.test.ts` and `app/utils/studyFilters.test.ts`.
- Step 4: `server/utils/stats.test.ts`.
- Steps 2, 3, and 5: screenshots and API checks against the fresh build, with
  `GAQ_SRS_DATA_DIR` in a scratch folder, so the real library is untouched.

## Notes for the AI

- Don't route labels through `normalizeThemeSlot`: it strips suffixes, which
  would change how existing OP/ED slots read.
- `classifyThemeSlot` must check for an insert before its prefix checks, even
  though no insert slot starts with OP or ED.
- No em dashes in comments or docs.

## Completion evidence

- `bun run test`: 83 files, 1321 tests passing. `bun run build`: passing.
  No typecheck is available (no local `tsc`/`vue-tsc`); the widened
  `ThemeSlotType` was reviewed by hand at every use.
- Isolated run (fresh build, scratch `GAQ_SRS_DATA_DIR`): Study with Typed
  Answers and the OP/ED category shows Opening / Ending / Insert; picking
  Insert disables the number field; submitting on the insert card grades the
  Opening/Ending row "Insert" correct (+50).
- `/api/study/next` with one OP and one insert card: no filter `dueCount` 2,
  `["IN"]` 1 (the insert), `["OP"]` 1 (the OP), `["OP","IN"]` 2.
- `/cards` screenshot: the table row and the player's theme badge read
  "Insert" for the insert card and `OP1` for the opening.
