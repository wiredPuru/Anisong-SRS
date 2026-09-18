# Feature: Category settings menu + Opening/Ending number category

**From build-plan:** feature 66a
**Status:** verified

## Goal

Let a player studying with Typed Answers (feature 65) optionally also guess
the theme's Opening/Ending number for bonus points, on top of the existing
anime-name guess. Adds the settings sub-menu that will hold every extra
guessable category (this one, plus feature 66b's Song name later), toggled
independently and remembered like the Typed Answers preference itself.
Anime name stays mandatory and always on - it is the only category that
still drives the card's SRS pass/fail; everything toggled on in this menu
is a bonus score layered on top, never a scheduling input.

## In scope

- A `StudyTypedAnswerCategoriesModal.vue` settings popup (mirrors
  `StudyAutoRevealSettingsModal.vue`), opened from a small settings button
  next to the existing "Typed Answers" toggle in `StudyDisplayToggles.vue`.
  Shows "Anime name" as a locked, always-on row for context, plus one
  toggle: "Opening/Ending number". Disabled while Typed Answers itself is
  off, and while a question is mid-result (`typedAnswersLocked`), matching
  how the Typed Answers toggle itself is already locked.
- A persisted `typedAnswerCategories` preference (`{ themeSlot: boolean }`,
  default `{ themeSlot: false }`), remembered via `localStorage` the same
  way `typedAnswers` already is.
- The Opening/Ending number category itself: when enabled, a compact
  Opening/Ending + number picker renders next to the anime answer box.
  Submitting the existing anime answer (Submit, Enter, or Give up) also
  grades whatever is currently picked in this control, independently of
  the anime result.
- Grading normalizes the card's stored `themeSlot` to its Opening/Ending
  type and leading number before comparing (see Data / contracts) - a real
  finding from the live database, not a guess: `themeSlot` values are not
  always the clean `"OP1"`/`"ED2"` shape the data model documents. The
  local library actually contains suffixed variants (`ED1-EN`, `OP2-EN`,
  `ED7-ShounenHen`, `ED1-TV`) and numbers up to 30 (`ED30`, from a
  long-running show). A player can't reasonably type or pick a `-EN`/
  `-ShounenHen` suffix, so grading matches on type + leading number only.
- Extend `quizScore.ts` with a flat, uncombo'd bonus-points transition
  (see Data / contracts) so bonus categories add to the session's total
  score without touching combo, correct/answered, or accuracy - those stay
  scoped to the anime-name signal alone, unchanged from feature 65.
- Extend the result panel (`StudyQuizResult.vue`) to show the
  Opening/Ending result as its own correct/wrong row with its own points,
  alongside the existing anime result, only when that category was
  enabled for the question just answered.
- With the Opening/Ending category off (today's default), Study behaves
  byte-for-byte like it does today - no new component renders, no new
  state is read, the existing anime-only flow is untouched.

## Out of scope

- The Song name category (feature 66b) - a separate sub-feature, since it
  needs its own redacted search endpoint work to avoid leaking the anime
  identity through song search results.
- Any change to SRS scheduling, `box`/`nextReviewAt`, or `ReviewLog` -
  those remain driven by the anime-name result only, exactly as today.
- Any change to the anime category's own combo, accuracy, or `correct`/
  `answered` counters - bonus categories add only to `score`.
- A generic "framework" for arbitrary future categories beyond what 66b
  will need; this only builds what Opening/Ending requires; 66b may need
  its own follow-up structural changes and that's fine.
- Fuzzy or partial-credit grading for the Opening/Ending guess - exact
  type + number match only, same "no fuzzy grading" stance feature 65
  already took for the anime guess.
- Any change to `StudyTypedAnswer.vue`'s own internals, its Enter-to-submit
  shortcut, or its Submit/Give-up buttons - the new category is graded
  alongside the *existing* submit path, not through a new shared submit
  component.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Category settings state + modal.** Add the persisted
  `typedAnswerCategories` ref (`{ themeSlot: boolean }`, `localStorage` key
  `gaqSrs:typedAnswerCategories`, same mount/watch pattern as
  `typedAnswers`/`TYPED_ANSWERS_STORAGE_KEY` in `study/index.vue`). Add
  `StudyTypedAnswerCategoriesModal.vue` (locked "Anime name" row + one
  "Opening/Ending number" toggle button, `Escape`-to-close, same shell as
  `StudyAutoRevealSettingsModal.vue`). Add a small settings-trigger button
  next to "Typed Answers" in `StudyDisplayToggles.vue` (new prop
  `typed-answer-categories`, new `update:typed-answer-categories` emit),
  visible only when `typedAnswers` is on, disabled while
  `typedAnswersLocked`. Nothing yet reads the new preference to change
  answering behavior.
  *Done when:* the settings button opens the modal only while Typed
  Answers is on; toggling "Opening/Ending number" persists across a page
  reload; the modal is inert/hidden appropriately while a result is
  showing; `bun run build` passes; no visible or behavioral change to
  Study otherwise.
- [x] **Step 2 - Opening/Ending grading logic (pure, no UI yet).** Add
  `app/utils/themeSlotAnswer.ts`: `ThemeSlotSelection { type: "OP" | "ED";
  number: number }`, `formatThemeSlot`, `normalizeThemeSlot` (regex-parses
  a raw `themeSlot` string to `{ type, number }`, tolerant of the real
  suffixed values found in the library), and `evaluateThemeSlotAnswer`
  (boolean), each with Vitest coverage including a suffixed input
  (`"ED7-ShounenHen"` grades correctly against `{ type: "ED", number: 7
  }`). Extend `quizScore.ts` with `BONUS_CATEGORY_POINTS` (50) and
  `applyBonusCategory(current, correct)` (adds to `score` only, leaves
  `combo`/`correct`/`answered`/`bestCombo` untouched), with Vitest
  coverage. No component or page changes in this step - these functions
  have no caller yet.
  *Done when:* `bun run test` passes, including the suffix-tolerant
  normalization case (`"ED7-ShounenHen"`, `"OP2-EN"`), a two-digit case
  (`"ED30"`), and `applyBonusCategory`'s correct/incorrect cases.
- [x] **Step 3 - Answer control + wiring into submit.** Add
  `StudyThemeSlotAnswer.vue`: an Opening/Ending segmented toggle plus a
  number input (`min="1" max="30"`, matching the real observed range),
  `v-model:selection` bound from `study/index.vue`. Placement revised
  during browser verification: two overlay positions inside the player
  frame were tried and both collided with the frame's existing content
  (the anime answer box, its suggestion dropdown, and the playback
  controls already fill a 16:9 frame edge-to-edge at a 390px viewport -
  there was no free space left for a third overlaid element). It instead
  renders inline in the study header, next to `StudyDisplayToggles`
  (`:key="presentationKey"` for a fresh mount per card), reusing that
  row's already-proven responsive wrapping instead of fighting the video
  frame for room. Shown only when `typedAnswerCategories.themeSlot` is
  true. Add a `themeSlotSelection` ref in `study/index.vue`, reset to
  `null` alongside the other per-card state in the existing
  `watch([presentationKey, scope], ...)`. In `saveTypedAnswer`, when
  `themeSlotSelection.value` is non-null, grade it with
  `evaluateThemeSlotAnswer`/`applyBonusCategory` from Step 2. Extend
  `QuizResultPhase` with `bonusResults: { category: "themeSlot"; correct:
  boolean; pointsAwarded: number; selectedLabel: string; correctLabel:
  string }[]`, populated only for categories that had a non-null
  selection at submit time (a blank bonus control is skipped, not graded
  as wrong).
  *Done when:* with the category on, picking Opening/Ending + a number and
  submitting the anime answer (via Submit, Enter, or Give up) grades both
  independently in one action and `quizResult.bonusResults` reflects it; a
  blank Opening/Ending control at submit time contributes nothing to
  `bonusResults`; `bun run build` passes.
- [x] **Step 4 - Result panel + verification.** Extend
  `StudyQuizResult.vue` to render each `bonusResults` entry as its own
  compact correct/wrong row with its own points, below the existing
  anime result. Confirm the header's `StudyQuizScore` needs no change
  (bonus points already flow into `quizScore.score`, which it already
  displays). Full browser verification: Opening/Ending on vs. off,
  correct/wrong bonus outcomes, a skipped bonus control, Give up with a
  bonus pick present, and the narrow-width layout with the extra overlay
  control present.
  *Done when:* a correct Opening/Ending guess shows its own "+50" row and
  raises the header's total; a wrong guess shows the correct answer with
  no points; a skipped guess shows no bonus row at all; the
  category-off case is visually and functionally identical to before this
  feature; `bun run test` and `bun run build` both pass; narrow-width
  (390px) shows no clipping of the added control.

## Files / areas

- `nuxt-app/app/pages/study/index.vue` - persisted category state,
  `themeSlotSelection` ref and its reset, grading call inside
  `saveTypedAnswer`, `bonusResults` construction, new component wiring.
- `nuxt-app/app/components/study/StudyDisplayToggles.vue` - new settings
  trigger button and props/emit for the categories modal.
- New `nuxt-app/app/components/study/StudyTypedAnswerCategoriesModal.vue`.
- New `nuxt-app/app/components/study/StudyThemeSlotAnswer.vue`.
- New `nuxt-app/app/utils/themeSlotAnswer.ts` + colocated
  `themeSlotAnswer.test.ts`.
- `nuxt-app/app/utils/quizScore.ts` - new `BONUS_CATEGORY_POINTS` constant
  and `applyBonusCategory` function + test additions in `quizScore.test.ts`.
- `nuxt-app/app/components/study/StudyQuizResult.vue` - new `bonusResults`
  prop and its rendered rows.
- No server route, database schema, or persisted (server-side) setting
  changes - this is entirely client/session state, same as
  `typedAnswers` itself.

## Data / contracts

**`TypedAnswerCategories`** (new, client-only, `localStorage`-persisted):
```ts
interface TypedAnswerCategories {
  themeSlot: boolean;
}
```
Deliberately only the field this sub-feature needs - feature 66b adds a
`songName` field when it actually builds that category, rather than this
step reserving an unused one now.

**`ThemeSlotSelection`** (new, `app/utils/themeSlotAnswer.ts`):
```ts
type ThemeSlotType = "OP" | "ED";
interface ThemeSlotSelection { type: ThemeSlotType; number: number }
```

**Theme slot normalization** (load-bearing - the real data has suffixed
variants and numbers up to 30, confirmed by querying the live library):
```ts
function normalizeThemeSlot(rawSlot: string): { type: ThemeSlotType; number: number } | null
```
Parses the leading `OP`/`ED` + digits from a raw `themeSlot` string
case-insensitively, ignoring any `-SUFFIX` (`"ED7-ShounenHen"` ->
`{ type: "ED", number: 7 }`). Returns `null` only if the stored value
doesn't start with a recognizable `OP`/`ED` + number, which should not
happen given the schema, but the function stays total rather than
throwing.

**`evaluateThemeSlotAnswer(expectedSlot: string, selection:
ThemeSlotSelection): boolean`** - normalizes `expectedSlot` and compares
type + number to `selection`. No `"unavailable"` state like the anime
category has: `themeSlot` is a non-null column, so every card has one.

**`QuizResultPhase`** (extends the existing interface in
`study/index.vue`):
```ts
interface QuizResultPhase {
  presentationKey: number;
  result: "pass" | "fail";       // unchanged: anime result only
  selectedTitle: string | null;  // unchanged: anime selection only
  correctTitle: string;          // unchanged
  pointsAwarded: number;         // unchanged: anime points only
  bonusResults: BonusCategoryResult[]; // new
}

interface BonusCategoryResult {
  category: "themeSlot";
  correct: boolean;
  pointsAwarded: number;
  selectedLabel: string;  // e.g. "OP2", from the user's own selection
  correctLabel: string;   // e.g. "OP1", the card's normalized theme slot
}
```
`bonusResults` holds one entry per enabled category that had a non-null
selection at submit time - an enabled-but-blank category is omitted
entirely (skipped, not graded as wrong).

**Scoring** (`app/utils/quizScore.ts` additions; existing
`createQuizScore`/`applyQuizResult`/`quizAccuracy` untouched):
```ts
const BONUS_CATEGORY_POINTS = 50;
function applyBonusCategory(current: QuizScore, correct: boolean): QuizScoreTransition
```
A correct bonus adds `BONUS_CATEGORY_POINTS` to `score.score` only;
`combo`, `bestCombo`, `correct`, and `answered` are untouched by design -
those remain the anime-recognition signal exactly as feature 65 defined
them. A wrong or skipped bonus adds nothing and does not reset the anime
combo.

**Submit/Give-up ownership stays with the anime category.** No new shared
submit button or wrapper component: `StudyTypedAnswer.vue`'s existing
Submit/Give-up buttons and Enter shortcut are untouched. `saveTypedAnswer`
(already the single place a typed answer is graded and saved) additionally
reads `themeSlotSelection.value` at that moment and grades it if present.
This is what keeps the category-off path byte-for-byte identical to
today: nothing about the existing submit path changes shape, it just does
one more optional thing when there's bonus state to look at.

## Testing

- Vitest (`app/utils/themeSlotAnswer.test.ts`): `normalizeThemeSlot` on a
  plain slot (`"OP1"` -> `{OP,1}`), a suffixed slot (`"ED7-ShounenHen"` ->
  `{ED,7}`, `"OP2-EN"` -> `{OP,2}`), a two-digit slot (`"ED30"` ->
  `{ED,30}`), lowercase input, and a malformed/empty string (`null`).
  `evaluateThemeSlotAnswer` for a matching pick, a wrong number, a wrong
  type, and a suffixed expected value matched against the right plain
  pick.
- Vitest (`app/utils/quizScore.test.ts` additions): `applyBonusCategory`
  on correct (adds exactly `BONUS_CATEGORY_POINTS`, combo/correct/answered
  unchanged) and incorrect (adds nothing, nothing reset).
- Browser: Opening/Ending category off behaves identically to feature 65
  (regression check); turning it on shows the picker; submitting with a
  correct pick shows both result rows and the summed score; a wrong pick
  shows the correct answer with no bonus points; leaving the picker blank
  and submitting shows no bonus row; Give up with a bonus pick present
  still grades the bonus; the settings modal is disabled while Typed
  Answers is off and while a result is showing; narrow width (390px) has
  no clipping.
- `bun run test` and `bun run build` from `nuxt-app/`.

## Notes for the AI

- This app's own explicit stance (feature 65's "Out of scope") is no
  fuzzy grading - keep the Opening/Ending match exact (after suffix
  normalization only), same as the anime category's exact-AniList-ID
  match.
- Don't let bonus-category work touch `applyQuizResult`, `createQuizScore`,
  or `quizAccuracy` - add alongside, not into, those functions, so
  feature 65's existing tests and behavior stay provably unchanged.
- `themeSlot` really does contain suffixed variants and numbers into the
  high 20s/30 in the real library (verified via direct query, not
  assumed) - don't narrow the number input's range below 30, and don't
  grade on exact string equality against the raw stored value.
- Keep `StudyThemeSlotAnswer.vue` visually and structurally separate from
  `StudyTypedAnswer.vue`'s own grid/layout - it lives in the study header
  (see Step 3), not injected into the anime box's markup, so the existing
  overlay CSS needs no changes.
- The settings-trigger button's icon/label and exact modal copy are
  implementation latitude; the locked behavior is: Anime name always
  shown as non-toggleable, Opening/Ending as the one live toggle, gated on
  Typed Answers being on and not locked mid-result.
