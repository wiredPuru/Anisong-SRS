# Feature: Song name category

**From build-plan:** feature 66b
**Status:** verified

## Goal

Add the second bonus category to Typed Answers: guessing the **song's own
title**, alongside the mandatory anime-name guess and 66a's optional
Opening/Ending number. The player gets a search-as-you-type song box whose
suggestions are **redacted** - song title and artist only, never the anime
they belong to - so using the search aid can't hand over the answer to the
anime question being asked in the same breath. Graded by exact (normalized)
song-title match against the current card, scored as flat bonus points
through 66a's existing `applyBonusCategory`, and completely absent from
Study when the category is off.

This closes feature 66.

## In scope

- A new `songName` field on `TypedAnswerCategories` (default `false`) plus a
  "Song name" toggle row in the existing
  `StudyTypedAnswerCategoriesModal.vue`, persisted by the same
  `localStorage` write 66a already does. An existing stored
  `{"themeSlot":true}` upgrades for free - `study/index.vue` already merges
  over `DEFAULT_TYPED_ANSWER_CATEGORIES`.
- A **redacted** server route, `GET /api/lookup/song-answer-search?q=`,
  returning only `{ key, songTitle, artistName }` per match. It reuses
  `searchSongEntries()` (AnisongDB first, animethemes.moe fallback, the
  existing search path) and drops every anime-identifying field before it
  leaves the server: no `animeAniListId`, no `animeTitleRomaji`, no
  `themeSlot`, no clip URLs.
- A `useSongAnswerSearch()` composable mirroring `useAnimeAnswerSearch()`'s
  behavior (2-character minimum, 250ms debounce, latest-request wins, small
  query cache, 10 results, its own error string).
- A `StudySongAnswer.vue` combobox living in the `.side` column above the
  result/info panel, shown only while Typed Answers and the Song name
  category are both on and no result is showing. Keyed on
  `presentationKey` for a fresh mount per card.
- `evaluateSongAnswer()` in a new `app/utils/songAnswer.ts`: normalizes the
  typed answer and compares it against **both** the card's `songTitle` and
  its `songTitleNative`, so a player who types the Japanese title of a
  card stored under a romanized one still scores.
- Grading wired into the existing `gradeBonusCategories()` in
  `study/index.vue`, reusing `applyBonusCategory` and
  `BONUS_CATEGORY_POINTS` (50) exactly as 66a defined them. A blank box at
  submit time is **skipped**, not graded wrong - same rule as the
  Opening/Ending picker.
- `BonusCategoryResult["category"]` widened to `"themeSlot" | "songName"`,
  with a matching label in `StudyQuizResult.vue`'s existing
  `BONUS_CATEGORY_LABELS` map. The row markup itself is unchanged.
- With Song name off (the default), Study behaves exactly as it does after
  66a: no new component renders, no new fetch is made, no new state is read.

## Out of scope

- Any change to SRS scheduling, `box`/`nextReviewAt`, `ReviewLog`, or the
  anime category's `combo`/`correct`/`answered`/accuracy counters. Bonus
  categories still add to `score` only.
- Fuzzy, partial-credit, or edit-distance grading. Consistent with feature
  65's stance and 66a's: exact match after normalization only (see Data /
  contracts for exactly what normalization does and does not do).
- Punctuation-insensitive matching (`"READY!!"` vs `"READY!"` stays wrong).
  The search box exists precisely so the player can pick the exact title
  instead of retyping it.
- Giving the song box its own submit. `StudyTypedAnswer.vue`'s Submit /
  Enter / Give up remain the single submit path for the round, untouched,
  exactly as 66a arranged it.
- A third category, or a generic registry for future ones. This is the last
  category feature 66 calls for.
- Hiding the song title from `StudyInfoPanel` beyond what Typed Answers
  already does - the panel is already blurred and inert during the question.
- Any database, schema, or server-side settings change. Like 66a, this is
  entirely client/session state plus one read-only lookup route.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Share the answer-search machinery.** Extract the debounce /
  latest-request / cache / loading / error engine out of
  `useAnimeAnswerSearch.ts` into `app/composables/useAnswerSearch.ts`
  (`useAnswerSearch<T>({ search, key, errorMessage })` - built with no `limit`
  option, since both callers use the same cap and an unused knob is dead
  configuration), and
  reimplement `useAnimeAnswerSearch` on top of it with no behavior change -
  same 2-character floor, same 250ms debounce, same 10-result cap, same
  dedupe by `aniListId`, same error copy. **No new caller yet.** The
  existing `useAnimeAnswerSearch.test.ts` is the guard and must not be
  edited to make this pass.
  *Done when:* `bun run test` passes with `useAnimeAnswerSearch.test.ts`
  byte-for-byte unchanged; `bun run build` passes; the anime answer box on
  `/study` behaves identically in the browser (type, debounce, pick,
  clear).
- [x] **Step 2 - Redacted song search (server + composable).** Add
  `server/utils/songAnswerOptions.ts` exporting `toSongAnswerOptions(entries:
  readonly SongAnswerSource[]): SongAnswerOption[]` - typed on a narrow
  `{ songTitle, artistName }` input rather than `FilteredSongSearchEntry`, so
  the mapper structurally cannot read an anime field. Drops entries with no
  `songTitle`, dedupes on a lowercased `title|artist` key, caps at 10, and
  returns **only** `{ key, songTitle, artistName }`. Add
  `server/api/lookup/song-answer-search.get.ts` (same `q`-required 400 shape
  as `song-search.get.ts`) calling `searchSongEntries(q)` then that mapper.
  Add `app/composables/useSongAnswerSearch.ts` on Step 1's helper, keyed on
  `key`. Colocated Vitest for the mapper. Nothing renders it yet.
  *Done when:* `bun run test` passes including the mapper's redaction,
  dedupe, and cap cases; hitting
  `/api/lookup/song-answer-search?q=gurenge` in a browser returns results
  whose JSON contains **no** anime title, AniList id, theme slot, or clip
  URL; `?q=` alone returns 400; `bun run build` passes.
- [x] **Step 3 - Grading logic + the setting.** Add `app/utils/songAnswer.ts`
  with `normalizeSongTitle` and `evaluateSongAnswer(card, typed)` (see Data
  / contracts) plus colocated Vitest. Add `songName: boolean` to
  `TypedAnswerCategories` and `DEFAULT_TYPED_ANSWER_CATEGORIES`, and a
  second toggle row ("Song name") in
  `StudyTypedAnswerCategoriesModal.vue`, copying the Opening/Ending row.
  Nothing yet renders an answer box or calls the grader.
  *Done when:* `bun run test` passes including the case-, width-, and
  whitespace-normalization cases, the native-title match, and the
  punctuation-mismatch **failure** case; toggling "Song name" in the modal
  persists across a page reload; a pre-existing stored
  `{"themeSlot":true}` still loads with Opening/Ending on and Song name
  off; `bun run build` passes; Study is otherwise visually and behaviorally
  unchanged.
- [x] **Step 4 - Answer box, wiring, and result row.** Add
  `StudySongAnswer.vue` (combobox over `useSongAnswerSearch`, suggestions
  showing song title with artist as a `<small>` subtitle, `Escape` closes,
  arrow keys move, `Enter` picks the highlighted suggestion and otherwise
  does nothing, never auto-focuses). Render it in `.side` above
  `StudyQuizResult`, gated on `typedAnswers && !quizResult &&
  typedAnswerCategories.songName`, `:key="presentationKey"`, disabled by the
  same expression `StudyThemeSlotAnswer` uses. Add a `songAnswerText`
  ref in `study/index.vue`, reset to `null` in the existing
  `watch([presentationKey, scope], ...)` beside `themeSlotSelection`. Widen
  `BonusCategoryResult["category"]` to `"themeSlot" | "songName"`, grade the
  song answer **first** in `gradeBonusCategories`, and add the `songName:
  "Song name"` entry to `StudyQuizResult.vue`'s label map. Full browser
  verification.
  *Done when:* with the category on, typing a song name (picked from the
  list or typed freehand) and submitting the anime answer grades both in one
  action; a correct song shows its own "+50" row above the Opening/Ending
  row and raises the header total; a wrong song shows `typed → correct` with
  "+0"; a blank box shows no song row at all; Give up with a song typed
  still grades it; the box never steals focus from the anime input; page
  hotkeys (`v`, `a`, `p`, `l`) do not fire while typing in it; with the
  category off Study is identical to 66a; `bun run test` and `bun run build`
  pass; 390px width shows no clipping or dropdown overflow.

## Files / areas

| File | Why |
|---|---|
| `app/composables/useAnswerSearch.ts` (new) | Shared debounce/latest-request/cache engine. |
| `app/composables/useAnimeAnswerSearch.ts` | Reimplemented on the helper, behavior unchanged. |
| `app/composables/useSongAnswerSearch.ts` (new) | Redacted song suggestions. |
| `server/utils/songAnswerOptions.ts` + `.test.ts` (new) | Redaction, dedupe, cap - the testable part. |
| `server/api/lookup/song-answer-search.get.ts` (new) | The read-only route. |
| `app/utils/songAnswer.ts` + `.test.ts` (new) | Normalization and grading. |
| `app/utils/typedAnswerCategories.ts` | New `songName` field + default. |
| `app/components/study/StudyTypedAnswerCategoriesModal.vue` | Second toggle row. |
| `app/components/study/StudySongAnswer.vue` (new) | The combobox itself. |
| `app/components/study/StudyQuizResult.vue` | One new entry in `BONUS_CATEGORY_LABELS`. |
| `app/utils/quizScore.ts` | `BonusCategoryResult["category"]` union widened only. |
| `app/pages/study/index.vue` | `songAnswerText` ref + reset, grading call, component wiring. |

No database schema, migration, or server-side settings change.

## Data / contracts

**`SongAnswerOption`** (new, returned by the redacted route; declared
server-side in `server/utils/songAnswerOptions.ts` and again by hand in
`useSongAnswerSearch.ts`, per the project's deliberate two-copy convention):

```ts
interface SongAnswerOption {
  key: string;            // lowercased "title|artist", the dedupe + v-for key
  songTitle: string;
  artistName: string | null;
}
```

Load-bearing: this shape is the redaction. Nothing anime-identifying may be
added to it - not the anime title, not `animeAniListId`, not `themeSlot`,
not a clip URL. A reviewer adding a field here is reintroducing the spoiler
this sub-feature exists to prevent.

**`TypedAnswerCategories`** (extended):

```ts
interface TypedAnswerCategories {
  themeSlot: boolean;
  songName: boolean;      // new, default false
}
```

**Grading** (`app/utils/songAnswer.ts`):

```ts
function normalizeSongTitle(value: string): string
function evaluateSongAnswer(
  card: Pick<CardWithDetails, "songTitle" | "songTitleNative">,
  typed: string,
): boolean
```

`normalizeSongTitle` applies, in order: Unicode NFKC normalization (so a
full-width `Ｒ` or `！` typed on a Japanese IME matches its half-width
stored form), lowercasing, and **removing every whitespace character**. It
deliberately does **not** strip punctuation, remove diacritics, or do any
distance-based matching - the suggestion list is the affordance for getting
the exact title, and silent fuzziness would make a "wrong" verdict
unexplainable.

**Revised during Step 4 on browser evidence.** The draft collapsed
whitespace runs to a single space rather than removing it. Live testing on
card 409 found the library storing `"Kaze no Tadori Tsuku Basho"` while the
search provider offers the same song as `"Kaze no Tadoritsuku Basho"` -
so picking the one suggestion on offer graded **wrong**. Romanized Japanese
has no agreed word boundaries, so this is systematic, not a one-off.
Dropping spaces entirely removes exactly that disagreement while leaving
punctuation, characters, and ordering fully significant; two genuinely
different songs distinguished only by spacing do not exist. The regression
is pinned by a test named for this card.

`evaluateSongAnswer` returns `true` when the normalized typed value equals
the normalized `songTitle` **or** the normalized `songTitleNative`. Both
fields are non-null on `CardWithDetails` (`songTitleNative` falls back to
`Song.title`), so there is no `"unavailable"` state here, same as
`evaluateThemeSlotAnswer`.

**`BonusCategoryResult`** (widened, `app/utils/quizScore.ts`):

```ts
interface BonusCategoryResult {
  category: "themeSlot" | "songName";   // was "themeSlot"
  correct: boolean;
  pointsAwarded: number;
  selectedLabel: string;   // what the player typed, trimmed
  correctLabel: string;    // the card's songTitle
  }
```

`applyBonusCategory`, `BONUS_CATEGORY_POINTS`, `createQuizScore`,
`applyQuizResult`, and `quizAccuracy` are **not** modified - the song
category is one more caller of the same 66a machinery, not a change to it.

**Skipped vs wrong.** `songAnswerText` is `null` until the player types
something, and `gradeBonusCategories` pushes a `songName` entry only when
the trimmed text is non-empty. An untouched box contributes nothing to
`bonusResults` and nothing to the score.

**Normalization is duplicated on purpose.** The route's dedupe key is a
plain lowercase-and-trim built inline; `normalizeSongTitle` is the
load-bearing one and lives client-side. They are not shared, because a
server route cannot import from `app/utils/`, and because dedupe quality and
grading correctness are independent concerns that should be free to diverge.
Don't "fix" this into one function.

## Testing

- **Vitest, `app/utils/songAnswer.test.ts`:** `normalizeSongTitle` on mixed
  case, leading/trailing and doubled internal whitespace, and a full-width
  input (`"ＲＥＡＤＹ！！"` -> `"ready!!"`). `evaluateSongAnswer` on an exact
  match, a case-only difference, a native-title match against a romanized
  `songTitle`, a whitespace-only difference, a punctuation mismatch
  (`"READY!"` vs stored `"READY!!"` -> `false`), and an empty typed string
  (`false`).
- **Vitest, `server/utils/songAnswerOptions.test.ts`:** the returned objects
  carry exactly the three `SongAnswerOption` keys and no anime field; two
  entries with the same title and artist collapse to one; entries with a
  `null` `songTitle` are dropped; more than 10 matches are capped at 10;
  two entries sharing a title but with different artists both survive.
- **Vitest, `app/composables/useAnimeAnswerSearch.test.ts`:** unchanged, and
  green after Step 1 - that file is the proof the extraction is behavior-
  preserving.
- **Not unit tested** (UI/integration, per the scope rule in
  `coding-standards.md`): `StudySongAnswer.vue`, the route handler wrapper,
  and the page wiring - those ride on browser evidence and the build.
- **Browser:** category off is identical to 66a (regression check); on shows
  the box; correct / wrong / blank / Give-up outcomes as listed in Step 4's
  done-when; both bonus rows present together when both categories are on;
  the suggestion dropdown never displays an anime title; page hotkeys inert
  while the box has focus; 390px narrow width.
- `bun run test` and `bun run build` from `nuxt-app/`.

## Notes for the AI

- **The redaction is the feature.** The whole reason 66a deferred this was
  that `/api/lookup/song-search` returns `animeTitleRomaji` on every row. Do
  not reuse that route from the client and strip fields in the component -
  the strip happens server-side, in `toSongAnswerOptions`, and its test
  asserts it.
- `artistName` **is** shown in suggestions. It can occasionally hint at the
  anime, and that is accepted: without it, two different songs sharing a
  title are indistinguishable in the list. Do not add any other
  disambiguator.
- Don't give `StudySongAnswer.vue` `autofocus` or a focus `watch`.
  `StudyTypedAnswer.vue` already focuses itself on mount and whenever
  `disabled`/`available` change; a second self-focusing input would fight it.
- `Enter` inside the song box must not submit the round. With the dropdown
  open it picks the highlighted suggestion; otherwise it does nothing
  (`preventDefault`, no emit). Submit ownership stays with the anime box.
- `useHotkeyGuard().isTypingTarget` already returns `true` for any `INPUT`,
  so the page's `v`/`a`/`p`/`l` hotkeys are handled - verify it in the
  browser rather than adding a second guard.
- Keep Step 1 strictly behavior-preserving. If making
  `useAnimeAnswerSearch.test.ts` pass requires editing that test, the
  extraction changed behavior and the step is wrong.
- Feature 65 and 66a both took an explicit no-fuzzy-grading stance. Hold it
  here even though a song title is harder to type than an anime title - the
  suggestion picker is the answer to that, not a looser comparison.
