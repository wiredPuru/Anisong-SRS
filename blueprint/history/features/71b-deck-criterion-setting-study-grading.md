# Feature: Deck criterion setting + Study grading

**From build-plan:** feature 71b (of 71 - Per-deck grading criteria)
**Status:** verified

## Goal

Let a manual deck choose what its cards are graded on - the anime title (the
default, today's behaviour), the song name, or both - and make Study actually
grade by it. 71a already stores `deck.gradingCriterion`, resolves it from the
study scope, and writes reviews to that criterion's own Leitner track; this
sub-feature adds the control that sets it and the Study behaviour that honours
it, in both Typed Answers mode (feature 65) and manual Pass/Fail mode.

## In scope

- Setting a manual deck's criterion from its `/decks` detail view, saved
  immediately, through `PATCH /api/decks`.
- Returning the criterion wherever a manual deck is read (`/api/decks`
  created list, `/api/decks/cards` for a created deck).
- A pure grading rule deciding Pass/Fail for a typed round from the active
  criterion, and which answer categories that criterion requires.
- Study telling you what you are graded on whenever it is not the anime title:
  a prompt beside the answer controls and a track label on the info panel's
  box readout.
- Typed Answers under `both`: the Song name box is forced on and required; the
  round passes only when anime and song are both right, and a blank song fails.
- Typed Answers under `song`: the Song name box becomes the primary answer
  with its own Submit / Give up, and the anime box is not shown.

## Out of scope

- **Stats** - 71c. Non-title reviews stay invisible to `/stats`, Home and the
  deck pass-rate tiles, exactly as 71a left them.
- **A criterion on artist or anime decks, or on "Study all"** - derived
  groupings with no row to hold one; they stay `title` (71a decision).
- **Per-deck isolation** of the same criterion - dropped in 71a's decisions.
- **Showing the criterion on the `/decks` grid tiles.** The detail view is the
  one place it is shown and set; a badge on every tile is polish, not needed
  to use the feature.
- **Forcing Typed Answers on.** A song-graded deck works with Typed Answers off
  (71a decision); the manual prompt just names what you grade yourself on.
- **Rewriting the stored Typed Answers category preference.** A deck that
  requires Song name forces it on for that session's rounds only; the
  remembered `gaqSrs:typedAnswerCategories` value is never written by this.
- **Deck export/import** - export covers artist/anime decks only (feature 9).
- **Changing points, combo rules, or the SRS algorithm.** The round result
  feeds `applyQuizResult` and `recordReview` exactly as today.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server: set and read a deck's criterion** - add
  `setManualDeckCriterion(id, criterion)` to `decks.ts` returning the same
  `ManualDeckResult` shape as `renameManualDeck`; add `gradingCriterion` to
  the server `ManualDeck` interface and every place that builds one
  (`listManualDecks`, `createManualDeck`, `renameManualDeck`). Extract
  `PATCH /api/decks` validation into `parseDeckPatchBody` in a new
  `server/utils/deckPatch.ts` (mirroring `parseDeleteBody`): `id` required,
  then at least one of `name` (string) or `gradingCriterion` (a valid
  criterion), either or both. `/api/decks/cards` returns `gradingCriterion`
  alongside `deckLabel` for a created deck only.
  *Done when:* `bun run test` is green including `parseDeckPatchBody` tests
  (missing id, non-numeric id, neither field, a non-string name, each valid
  criterion, an unknown / wrong-case / empty criterion, both fields together);
  `curl -X PATCH /api/decks -d '{"id":<deck>,"gradingCriterion":"song"}'`
  returns the deck with `gradingCriterion: "song"` and the row changes in the
  DB; an unknown criterion returns `400` and an unknown id `404`; a
  name-only PATCH still renames exactly as before;
  `/api/decks?type=created` and `/api/decks/cards?type=created&id=<deck>`
  both include the criterion; artist/anime `/api/decks/cards` responses are
  unchanged.

- [x] **Step 2 - /decks: the criterion control** - on a created deck's detail
  view, under the title, a "Graded on" segmented control (Anime title / Song
  name / Both) using the existing `tab-seg`/`tab-seg-btn` convention. Picking
  a segment PATCHes immediately (no save button, like the deck membership
  checkboxes); the control is disabled while the request is in flight, keeps
  the previous value and shows an inline error if it fails, and a short hint
  line says what the choice means ("Passes here move only this card's
  song-name schedule"). Not rendered for artist or anime decks. Client
  `ManualDeck` gains `gradingCriterion` in the same field order as the server's
  (F-09).
  *Done when:* in a browser, a created deck's detail view shows the control
  with its stored value selected; switching to Song name persists across a page
  reload; forcing the request to fail (stop the dev server, then click) leaves
  the old value selected with an error shown; artist and anime deck detail
  views have no control; `bun run build` passes.

- [x] **Step 3 - The grading rule (pure)** - add `app/utils/criterionGrading.ts`
  with `requiredCategories(criterion)` (`{ anime: boolean; songName: boolean }`:
  title -> anime; song -> songName; both -> both) and `gradeTypedRound(criterion,
  { anime, song })`, where `anime` is `"pass" | "fail" | null` (null = not
  asked or given up) and `song` is `boolean | null` (null = left blank). It
  returns `"pass" | "fail"`: every required category must be answered and
  correct, and a blank required category fails. Nothing calls it yet.
  *Done when:* `bun run test` is green including a table test covering, per
  criterion, correct / wrong / blank for each required category, and that a
  non-required category (song under `title`, anime under `song`) never changes
  the result.

- [x] **Step 4 - Study names the criterion** - `useStudySession` exposes the
  `criterion` ref it already holds. Whenever the criterion is not `title`,
  a one-line accent prompt sits in the side column above the answer controls:
  in manual mode it says what to grade yourself on ("Grade yourself on the song
  name"), with Typed Answers on it reads "Graded on: Song name" / "Anime +
  song". (Originally a header chip; moved in Step 5 because the header has no
  spare width at 1400px with Typed Answers on, and the chip pushed the score
  chip under the toggles.) `StudyInfoPanel` gains an
  optional `trackLabel` prop rendered beside its Learning / box readout
  (e.g. "Song track") so it is clear whose schedule that box is. Title-graded
  scopes render exactly as today - no chip, no prompt, no label.
  *Done when:* with a created deck set to `song` in Step 2, `/study` for that
  deck shows the prompt and the track label, and its info
  panel reads the song track - for a card whose `card.box` is above 1 (pick
  one with `select id, box from card`, adding it to the deck if none is in it
  yet), the panel shows Learning 0/N rather than the title track's box;
  `/study` for "all", an artist, and a title-graded created deck look unchanged
  (screenshots before/after); manual Pass/Fail in the song deck still writes a
  `song` `review_log` row; `bun run build` passes.

- [x] **Step 5 - Required Song name box (UI only)** - pass the active
  criterion into the answer stack and `StudyTypedAnswerCategoriesModal`. When
  `requiredCategories(criterion).songName` is true and Typed Answers is on,
  the Song name box renders regardless of the stored category toggle, with
  placeholder "Name the song (required)", and the modal shows Song name
  checked and disabled with a "Required by this deck" note. The stored
  `gaqSrs:typedAnswerCategories` value is never written by this. Grading is
  not changed yet, so on this step a `both` deck still grades by anime alone.
  *Done when:* in a `both` deck the Song name box is present with Song name
  unticked in the stored preference, and the modal cannot untick it; the
  `localStorage` value is identical before and after visiting that deck; a
  title-graded scope shows the box only when the stored toggle is on, exactly
  as today; `bun run build` passes.

- [x] **Step 6 - Typed Answers graded under `both`** - `saveTypedAnswer`
  computes the round result through `gradeTypedRound` instead of the anime
  result alone. When Song name is required it is part of the grade, not a
  bonus: `gradeBonusCategories` records it with `required: true` and 0 points
  (a new optional `required?: boolean` on `BonusCategoryResult`), and
  `StudyQuizResult` labels that row "Song name (required)". Opening/Ending
  stays an optional bonus.
  *Done when:* `bun run test` is green, including a `buildBurstPlan` case that
  a `required` row produces no bonus burst if that function needs touching; in
  a `both` deck in the browser: right anime + right song -> Correct and a
  `both` `review_log` pass; right anime + blank song -> fail; right anime +
  wrong song -> fail with the song row shown as required and the correct title;
  wrong anime + right song -> fail; a title-graded scope still awards Song name
  as an optional 50-point bonus exactly as today.

- [x] **Step 7 - Typed Answers under `song`** - the anime box is not rendered;
  `StudySongAnswer` gains a `primary` mode with Submit and Give up buttons,
  Enter submitting when no suggestion is highlighted, focus on mount, and the
  same `typingStarted` playback kick-off the anime box has. Submit grades via
  `gradeTypedRound` and feeds `applyQuizResult` / `recordReview` exactly like
  an anime answer does; the result panel's main answer shows the typed song
  and the correct song title instead of anime titles. The anime-identity
  "unavailable" check does not apply, since no anime answer is asked.
  Opening/Ending bonus still works.
  *Done when:* in a `song` deck in the browser: no anime box; typing starts
  playback; Enter with a right song -> Correct, combo +1, a `song`
  `review_log` pass and that card's `card_track` row advances while its `card`
  row does not; a wrong song and Give up both fail with the correct song shown;
  Continue advances to the next card; the Opening/Ending bonus still awards
  points; switching to an "all" session brings the anime box back unchanged;
  `bun run build` passes.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/decks.ts` | `setManualDeckCriterion`; `gradingCriterion` on `ManualDeck`. |
| `nuxt-app/server/utils/deckPatch.ts` + `.test.ts` | New. `parseDeckPatchBody`. |
| `nuxt-app/server/api/decks.patch.ts` | Rename and/or set criterion. |
| `nuxt-app/server/api/decks/cards.get.ts` | Returns the criterion for a created deck. |
| `nuxt-app/app/pages/decks/index.vue` | The "Graded on" control; client `ManualDeck`. |
| `nuxt-app/app/utils/criterionGrading.ts` + `.test.ts` | New. `requiredCategories`, `gradeTypedRound`. |
| `nuxt-app/app/composables/useStudySession.ts` | Exposes `criterion`. |
| `nuxt-app/app/pages/study/index.vue` | Chip, manual prompt, forced/primary song box, grading through the rule. |
| `nuxt-app/app/components/study/StudyInfoPanel.vue` | Optional `trackLabel`. |
| `nuxt-app/app/components/study/StudySongAnswer.vue` | `required` placeholder and `primary` mode. |
| `nuxt-app/app/components/study/StudyTypedAnswerCategoriesModal.vue` | Song name locked on when required. |
| `nuxt-app/app/components/study/StudyQuizResult.vue` | Required row label; song as the main answer under `song`. |
| `nuxt-app/app/utils/quizScore.ts` (+ `scoreBurst.ts` if needed) | Optional `required` on `BonusCategoryResult`. |

## Data / contracts

No schema change: `deck.gradingCriterion`, `card_track`, and
`review_log.criterion` all landed in 71a.

**Load-bearing (71c reads these):**

- Server `ManualDeck` gains `gradingCriterion: GradingCriterion`, after
  `createdAt` and before `cardCount`; the client copy in `decks/index.vue`
  mirrors that order (F-09).
- `PATCH /api/decks` body: `{ id: number; name?: string; gradingCriterion?:
  GradingCriterion }`, at least one of the two optional fields required.
  Returns `{ deck: ManualDeck }`. When both are sent, both are validated
  before either is written.
- `GET /api/decks/cards?type=created` gains `gradingCriterion`; artist/anime
  responses do not.
- `BonusCategoryResult` gains optional `required?: boolean`. Absent means an
  ordinary bonus, so every existing construction stays valid.

**Grading rule** (`app/utils/criterionGrading.ts`):

```ts
type GradingCriterion = "title" | "song" | "both";
function requiredCategories(c: GradingCriterion): { anime: boolean; songName: boolean };
function gradeTypedRound(
  c: GradingCriterion,
  answers: { anime: "pass" | "fail" | null; song: boolean | null },
): "pass" | "fail";
```

The criterion a round is graded by is the one `/api/study/next` returned with
that card - the same value 71a already echoes to `/api/study/review` - never
re-read from `/decks` mid-card, so the UI and the schedule written can never
disagree.

## Testing

Vitest is configured (`bun run test`), so the logic-test gate is on.

| Step | Test |
|---|---|
| 1 | `parseDeckPatchBody` - rejection and acceptance cases listed in the step. |
| 3 | `requiredCategories` and `gradeTypedRound` table test across all three criteria. |
| 6 | Existing `quizScore`/`scoreBurst` tests stay green with the new optional field; add a case that a `required` row produces no bonus burst if `buildBurstPlan` is touched. |

Steps 2, 4, 5, 6 and 7 are UI: browser evidence via the `playwright-cli` skill
(screenshots plus console checks) and `bun run build`.

**Run browser checks against a database copy**, as 71a did: `sqlite3
.data/gaq-srs.db ".backup <scratch>/gaq-srs.db"` then `GAQ_SRS_DATA_DIR=<scratch>
bun run dev --port <n>`. Song/both reviews write real `card_track` and
`review_log` rows, and the real library should not collect test reviews.

## Notes for the AI

- **Title-graded scopes must be pixel- and behaviour-identical to today.**
  Every new element renders only when the criterion is not `title`; every
  grading change routes through `gradeTypedRound`, whose `title` branch is the
  current anime-only result.
- The study page is ~1750 lines. Keep the new logic in `criterionGrading.ts`
  and small computed values (`requiredCategories(criterion)` once, reused),
  not new branches scattered across the template.
- `StudySongAnswer`'s Enter deliberately never submits today ("the anime box
  owns Submit/Give up"). Keep that true outside `primary` mode.
- Server routes only for DB access; the `/decks` control calls `PATCH
  /api/decks` with `$fetch`, and follows the page's existing error-message
  pattern (`extractErrorMessage`).
- Use the `tab-seg` convention `/decks` and `/stats` already use for the
  control rather than a new component style; colors from `main.css` tokens only.
- Hotkeyed buttons get the custom `.tooltip` span convention; the new song
  Submit/Give up are not hotkeyed beyond Enter, so no tooltip needed.
- No em dashes in code comments, commit messages, or spec updates.
