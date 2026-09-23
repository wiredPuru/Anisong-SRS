# Fix: Typed Answers ask exactly what the deck grades

**Type:** Fix
**Status:** verified

## The problem

With Typed Answers on, a manual deck graded on something other than the anime
title (feature 71/72) still shows the optional bonus boxes from the stored
answer-category preference (feature 66, `gaqSrs:typedAnswerCategories`). On a
deck graded on **Song name** only, the song box is the main answer (correct),
but if OP/ED is switched on as a bonus, the OP/ED picker appears too. So the
round asks more than the deck grades. The same leak shows the optional song box
on an `artist` deck, and the OP/ED bonus on `title+song` or `title+artist` decks.

Cause, in `app/pages/study/index.vue`:

```ts
const showSongAnswer = computed(() => typedAnswerCategories.value.songName || requiredAnswers.value.songName);
const showThemeSlotAnswer = computed(() => typedAnswerCategories.value.themeSlot || requiredAnswers.value.themeSlot);
```

The stored preference is OR-ed in for every criterion, not only the default one.
The categories modal matches this: on a non-title deck it still offers the
toggles for categories that deck doesn't grade.

## The fix

When the active criterion is not `title`, Typed Answers shows exactly the
criterion's categories. No optional bonus boxes, and the categories modal shows
each category as either "Required by this deck" or "Not asked by this deck", with
no toggles. When the criterion is `title` (Study all, artist and anime decks, and
created decks graded on the anime title), feature 66's optional bonuses work
exactly as they do today.

- Add a pure `visibleAnswerCategories(criterion, stored)` to
  `app/utils/criterionGrading.ts` returning `{ songName, themeSlot }`. It is the
  required categories when the criterion is not `title`, and the stored
  preference when it is `title`. Study's two computeds read from it. The artist
  box is already required-only (72b).
- The stored preference is never written by this. Returning to a title scope
  brings the user's bonuses back unchanged.

Must not break:

- title-graded scopes, which must be identical to today: bonus boxes, +50
  points, and the modal toggles
- required-row grading on `title+song`, `title+slot` and the like (72b)
- the song or artist main answer on `song` and `artist` decks

**Decision:** "title" here means the criterion, not the scope type. A created
deck graded on the anime title keeps the optional bonuses, because its criterion
is the default and nothing is required beyond the anime. Only decks graded on
something else lock Typed Answers to their criterion.

## Build steps

- [x] **Step 1 - Study shows only the criterion's categories** - add
  `visibleAnswerCategories` with a table test, and wire `showSongAnswer` /
  `showThemeSlotAnswer` to it.
  *Done when:* `bun run test` is green with cases for `title` (echoes the
  stored preference for every combination of the two toggles), `song`,
  `artist`, `title+song`, `title+slot` and `title+song+slot+artist` (equal to
  the required categories whatever is stored). In the browser, on a database
  copy with the OP/ED and song bonuses both stored on:
  - a `song` deck shows only the song box
  - an `artist` deck shows only the artist box
  - a `title+song` deck shows the anime and song boxes, with no OP/ED picker
  - Study all and a title-graded created deck still show both bonus boxes, and a
    right OP/ED pick still awards +50

  `gaqSrs:typedAnswerCategories` is byte-identical before and after.
  `bun run build` passes.

- [x] **Step 2 - Categories modal matches** - on a non-title deck the modal
  shows every category (Anime name, Song name, Opening/Ending number, Artist)
  with a "Required by this deck" or "Not asked by this deck" badge and no
  toggles. The hint reads "This deck decides what each round asks." A title
  scope's modal is unchanged.
  *Done when:* screenshots of the modal on a `song` deck (only Song name
  required, the rest "Not asked") and on Study all (unchanged toggles).
  Clicking nowhere in the non-title modal can change the stored preference.
  `bun run build` passes.

## Verify

1. Turn on Typed Answers.
2. In the answer-categories modal on Study all, switch on the Song name and
   OP/ED bonuses.
3. Open a created deck graded on Song name only and study it. Only the song box
   appears.
4. Go back to Study all. Both bonus boxes are back.
