# Feature: Deck control + Study grading for OP/ED and artist

**From build-plan:** feature 72b (parent: 72. Combined grading criteria)
**Status:** verified

## Goal

Make 72a's combination criteria usable. A manual deck's "Graded on" control
becomes four category checkboxes (Anime title, Song name, OP/ED number,
Artist), and Study grades a round on every category the deck requires: the
OP/ED picker becomes a required answer when the deck grades `slot`, and a new
free-text artist box appears when it grades `artist`. With Typed Answers off,
the manual prompt names every required category.

## In scope

- Client criterion model widened from 3 values to 72a's 11, with a client copy
  of `criterionCategories` / `buildCriterion` (F-09 duplication, same as the
  type).
- `requiredCategories` gains `themeSlot` and `artist`; `gradeTypedRound` takes
  answers for both, a blank required category failing like a blank required
  song does today.
- One pure copy helper that names any criterion (chip, manual prompt, track
  label), replacing Study's hand-written two-entry `CRITERION_COPY`, and
  producing exactly today's strings for `song` and `title+song`.
- `/decks`: the three-way segmented control becomes four checkboxes, saved
  immediately per click through the existing `PATCH /api/decks`.
- Study, Typed Answers on:
  - required OP/ED: the picker is forced on for the round, locked on in the
    categories modal, graded as a required 0-point row; an untouched picker is
    blank and fails.
  - required artist: a new free-text `StudyArtistAnswer` box, matched with the
    song-name normalization (NFKC, case-insensitive, whitespace dropped, no
    fuzzy matching), graded as a required 0-point row.
  - no anime asked: the main answer is the song if required, otherwise the
    artist, which then gets the same `primary` mode (Submit / Give up / Enter /
    playback kick-off) `StudySongAnswer` has.
- Study, Typed Answers off: the criterion prompt and the info panel's track
  label name every required category.

## Out of scope

- **`/stats` labels and notes for new combinations** - 72c. This sub-feature
  only keeps `/stats` compiling and never shows a blank label (see Notes).
- **Artist as an optional bonus category** in feature 66's menu (72 decision:
  artist is graded only). The artist box never appears on a deck that does not
  grade `artist`.
- **Artist autocomplete / search.** Free text only, per the build-plan line.
- **Fuzzy or alias matching**, and matching a native-script artist name
  (`Artist` stores one `name`; nothing else to match against).
- **Server changes.** 72a already validates every combination on deck PATCH,
  review POST and stats.
- **A criterion on artist/anime decks or "Study all"** (71a decision).
- **Changing points, combo, or the SRS algorithm.** Required rows award 0 and
  the round result feeds `applyQuizResult` / `recordReview` as today.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Client criterion model + copy helper (pure, no visible change)** -
  in `app/utils/criterionGrading.ts`: widen `GradingCriterion` to the 11
  canonical values in server order; add `GRADING_CATEGORIES`,
  `criterionCategories`, `buildCriterion` mirroring the server; widen
  `RequiredCategories` to `{ anime, songName, themeSlot, artist }` and
  `gradeTypedRound`'s answers to `{ anime, song, themeSlot, artist }`
  (`boolean | null` for the last three, null = blank); add
  `describeCriterion(criterion)` returning `{ chip, prompt, track }`. Add
  `app/utils/artistAnswer.ts` with `evaluateArtistAnswer(card, typed)`
  reusing `normalizeSongTitle`. Swap Study's `CRITERION_COPY` for
  `describeCriterion`, and pass `themeSlot: null, artist: null` at the one
  `gradeTypedRound` call site. Retype `/stats`' `TRACK_LABELS` /
  `TRACK_NOTES` so the build passes, falling back to
  `describeCriterion(track).chip` for a missing label.
  *Done when:* `bun run test` is green with the table tests listed under
  Testing; `bun run build` passes; with a `song` deck and a `title+song`
  deck, Study's prompt, chip and track label read exactly as before (same
  strings, screenshot) and a title-graded scope is unchanged.

- [x] **Step 2 - /decks: four category checkboxes** - replace
  `CRITERION_OPTIONS`' segmented control with four checkboxes (Anime title,
  Song name, OP/ED number, Artist) checked from
  `criterionCategories(deckCriterion)`. A click builds the next criterion
  with `buildCriterion` and PATCHes it immediately, the whole group disabled
  while in flight, keeping the old state and showing the existing inline
  error on failure. The last checked box cannot be unchecked; OP/ED number is
  disabled while Anime title is unchecked, and Anime title is disabled while
  OP/ED number is checked, each with a one-line reason. The hint line reads
  "A pass needs <spoken>, on a schedule of its own." for a non-title criterion and
  keeps today's title hint for `title`.
  *Done when:* in a browser, a created deck shows its stored categories
  checked; ticking Song name, OP/ED number and Artist on a title deck saves
  `title+song+slot+artist` (reload keeps it); unticking down to one category
  leaves that one disabled; OP/ED cannot be ticked with Anime title off and
  Anime title cannot be unticked with OP/ED on; a forced failure (stop the
  dev server, click) keeps the previous boxes with the error shown; artist
  and anime decks show no control; `bun run build` passes.

- [x] **Step 3 - Required OP/ED number in Typed Answers** - when
  `requiredAnswers.themeSlot`, render `StudyThemeSlotAnswer` regardless of the
  stored category toggle, with a "required" marker; the categories modal shows
  Opening/Ending number locked "Required by this deck". `gradeBonusCategories`
  emits a `required: true`, 0-point `themeSlot` row (blank shows "(blank)"),
  and `saveTypedAnswer` passes the slot result into `gradeTypedRound`. When
  not required, OP/ED stays today's optional 50-point bonus.
  *Done when:* in a `title+slot` deck: right anime + right slot -> Correct and a
  `title+slot` `review_log` pass; right anime + untouched picker -> fail with
  the row "Opening/Ending (required)" showing "(blank)" and the correct slot;
  right anime + wrong slot -> fail; wrong anime + right slot -> fail; the
  stored `gaqSrs:typedAnswerCategories` value is identical before and after;
  a title-graded scope still awards OP/ED as a 50-point bonus; `bun run test`
  and `bun run build` pass.

- [x] **Step 4 - Required artist box** - new
  `components/study/StudyArtistAnswer.vue`: a plain text input (no search),
  placeholder "Name the artist (required)", emitting `update:answer`, keyed on
  `presentationKey` like its siblings. Rendered in the bonus row whenever
  `requiredAnswers.artist` and a main answer other than the artist exists.
  `BonusCategoryResult["category"]` gains `"artist"`, with labels in
  `StudyQuizResult` ("Artist") and `scoreBurst` ("artist").
  `gradeBonusCategories` emits a required 0-point artist row;
  `saveTypedAnswer` grades it. The categories modal shows an "Artist -
  Required by this deck" locked row only when required.
  *Done when:* in a `title+artist` deck: right anime + artist typed in a
  different case and spacing (e.g. `yui  HORI` for `Yui Hori`) -> Correct and a
  `title+artist` pass; blank artist -> fail with "Artist (required)" showing
  "(blank)" and the correct name; wrong artist -> fail; a title-graded scope
  and a `title+song` deck show no artist box; `bun run test` and `bun run
  build` pass.

- [x] **Step 5 - Main answer without an anime question** - the round's main
  answer is anime if required, else song, else artist (one computed
  `mainAnswer`, replacing `songIsMainAnswer`). `StudyArtistAnswer` gains the
  `primary` mode `StudySongAnswer` has: Submit and Give up buttons, Enter
  submits, focus on mount, Space on an empty box and the first keystroke start
  playback; outside `primary`, Enter never submits. Give up clears the box
  before grading. The result panel's main answer shows the typed and correct
  artist when the artist is main. Under `song+artist` the song stays main and
  the artist is a required row.
  *Done when:* in an `artist` deck: no anime or song box; typing starts
  playback; Enter with the right artist -> Correct, combo +1, an `artist`
  `review_log` pass and that card's `card_track` row advancing while its
  `card` row does not; wrong artist and Give up both fail with the correct
  artist shown; Continue advances. In a `song+artist` deck the song box is
  primary and the artist row is required. An "all" session afterwards shows
  the anime box unchanged. `bun run build` passes.

- [x] **Step 6 - Manual mode and full-combination pass** - Typed Answers off,
  across `title+slot`, `title+song+slot+artist` and `artist` decks: the
  prompt reads "Grade yourself on ..." naming every category, the info
  panel's track label names the combination, and Pass/Fail writes the deck's
  criterion to `review_log`. Fix anything the walk-through turns up; no new
  behaviour.
  *Done when:* screenshots of all three decks in manual mode and of a
  `title+song+slot+artist` typed round with all three required rows in the
  result panel; `review_log` rows carry each deck's criterion; no console
  errors; `bun run test` and `bun run build` pass.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/app/utils/criterionGrading.ts` + `.test.ts` | Widened type, categories, `buildCriterion`, required/grade rule, `describeCriterion`. |
| `nuxt-app/app/utils/artistAnswer.ts` + `.test.ts` | New. `evaluateArtistAnswer`. |
| `nuxt-app/app/pages/decks/index.vue` | Four checkboxes replace the segmented control. |
| `nuxt-app/app/pages/study/index.vue` | Copy helper, required slot/artist, `mainAnswer`, grading inputs. |
| `nuxt-app/app/components/study/StudyArtistAnswer.vue` | New. Required and `primary` artist box. |
| `nuxt-app/app/components/study/StudyThemeSlotAnswer.vue` | Optional `required` marker. |
| `nuxt-app/app/components/study/StudyTypedAnswerCategoriesModal.vue` | Lock OP/ED and show Artist when required. |
| `nuxt-app/app/components/study/StudyQuizResult.vue` | `artist` label; artist as main answer. |
| `nuxt-app/app/utils/quizScore.ts`, `scoreBurst.ts` | `"artist"` in the category union and labels. |
| `nuxt-app/app/pages/stats/index.vue` | Type widening only, label fallback. |

## Data / contracts

No schema, route, or server change.

**Load-bearing (72c reads these):**

```ts
// app/utils/criterionGrading.ts (client copy of the server list, F-09)
export const GRADING_CATEGORIES = ["title", "song", "slot", "artist"] as const;
export type GradingCategory = (typeof GRADING_CATEGORIES)[number];
export type GradingCriterion =
  | "title" | "song" | "artist"
  | "title+song" | "title+slot" | "title+artist" | "song+artist"
  | "title+song+slot" | "title+song+artist" | "title+slot+artist"
  | "title+song+slot+artist";

export function criterionCategories(c: GradingCriterion): GradingCategory[];
export function buildCriterion(cats: Iterable<GradingCategory>): GradingCriterion | null;

export interface RequiredCategories { anime: boolean; songName: boolean; themeSlot: boolean; artist: boolean }
export function requiredCategories(c: GradingCriterion): RequiredCategories;
export function gradeTypedRound(
  c: GradingCriterion,
  answers: { anime: "pass" | "fail" | null; song: boolean | null; themeSlot: boolean | null; artist: boolean | null },
): "pass" | "fail";

// chip: "Song name", "Anime + song", "Anime + OP/ED + artist"
// prompt: "Grade yourself on the anime, the OP/ED number and the artist"
// track: "Song", "Anime + song", ...
// spoken: "the anime, the OP/ED number and the artist" (the /decks hint)
export function describeCriterion(c: GradingCriterion): { chip: string; prompt: string; track: string; spoken: string };
```

- `describeCriterion("song")` and `("title+song")` must return today's exact
  `CRITERION_COPY` strings; 72c uses `chip` as the `/stats` track label.
- `BonusCategoryResult["category"]` becomes `"themeSlot" | "songName" |
  "artist"`. `artist` rows are always `required: true` in this sub-feature.
- The criterion a round is graded by is still the one `/api/study/next`
  returned with the card (71b rule).

## Testing

Vitest is configured (`bun run test`), so the logic gate is on.

| Step | Test |
|---|---|
| 1 | `criterionCategories` / `buildCriterion` round-trip all 11 values and reject empty and slot-without-title (mirrors the server test). `requiredCategories` table for all 11. `gradeTypedRound`: per category, required + correct / wrong / blank, and a non-required category never changing the result (extend the existing table). `describeCriterion`: today's two strings exactly, plus one 3- and one 4-category case. `evaluateArtistAnswer`: exact, case, extra spaces, full-width NFKC, blank, wrong. |
| 3, 4 | Existing `quizScore` / `scoreBurst` tests stay green; add a case that a required `artist` row produces no burst. |

Steps 2-6 UI: browser evidence via the `playwright-cli` skill (screenshots,
console) plus `bun run build`.

**Run browser checks against a database copy**, as 71b did: `sqlite3
.data/gaq-srs.db ".backup <scratch>/gaq-srs.db"` then
`GAQ_SRS_DATA_DIR=<scratch> bun run dev --port <n>`. Combination reviews write
real `card_track` and `review_log` rows.

## Notes for the AI

- **Title, `song` and `title+song` decks must look and behave exactly as
  today.** Step 1 proves that for copy; every later step renders new elements
  only when the new categories are required.
- `/stats` must never render a blank track label between 72b and 72c: a deck
  graded on a new combination can gain reviews as soon as step 5 lands. Use
  `TRACK_LABELS[track] ?? describeCriterion(track).chip`; the proper labels and
  notes are 72c's.
- An untouched OP/ED picker already emits `null` (never a silent "OP1" guess);
  keep that, since it is what makes a required slot "blank".
- A card whose stored `themeSlot` does not parse (`normalizeThemeSlot` null)
  can never pass a required slot; the result row shows the raw slot as the
  correct answer. Accepted, not worked around.
- `/decks` disables the Anime title box while OP/ED is checked rather than
  silently dropping OP/ED, because dropping it would switch the deck onto a
  different track without the user choosing that.
- Each checkbox click is its own PATCH, so going from `title` to a 4-category
  criterion passes through intermediate criteria. Harmless: no track row is
  created until a review, and 72a's validation accepts every step.
- The study page is ~1840 lines. Keep rules in `criterionGrading.ts` and small
  computeds (`requiredAnswers`, `mainAnswer`); do not scatter per-category
  branches through the template.
- `StudyArtistAnswer` follows `StudySongAnswer`'s key handling
  (`shouldIgnoreAnswerKey`, IME composition) without its search.
- Colors from `main.css` tokens only; the checkbox group uses native
  checkboxes (already rose via `accent-color`).
- No em dashes in code comments, commit messages, or spec updates.
