# Fix: Study with Anime name off traps the categories modal and overlaps the hint

**Type:** Fix
**Status:** verified

## The problem

With Typed Answers on and Anime name switched off (feature 66 plus the
`b94e482` change that made Anime name optional), Study misbehaves in two ways.
Both are in the screenshots.

1. **The answer-categories modal locks itself, with no way back.** It shows
   every row as "Required / Not asked by this deck" and "This deck decides what
   each round asks", although no deck is involved. Cause:
   `StudyTypedAnswerCategoriesModal.vue` treats any session whose
   `requiredAnswers` is not title-only as deck-graded. Anime name off moves the
   session onto a song/artist track through `trackWithoutAnime` and
   `studyTrack` (`study/index.vue:19`), the server echoes that criterion back,
   and `requiredAnswers` is derived from it (`study/index.vue:155`). So the
   preference that caused the track also makes the modal read as deck-locked,
   and the toggles are gone. The preference is persisted
   (`gaqSrs:typedAnswerCategories`), so it survives a reload and stays stuck.
   The "Graded on: Song + artist" chip on the player is a symptom of the same
   confusion.
2. **The idle hint overlaps the input row.** The song and artist boxes, when
   `primary` (no anime asked), print "Start typing or press Space to play.
   Press Enter to submit, or the right arrow to give up." through an
   absolutely positioned `.answer-status` (`right: calc(40% + 22px)`). The text
   is longer than the space left of the 60% input, so it runs over the "SONG
   NAME" label and the input's placeholder.

A related inconsistency, in the same code: inside a manual deck graded on the
anime title, `next.get.ts:67` ignores `track` (the deck decides), yet the modal
still offers Anime name Off, and the round keeps asking the anime.

I have not reproduced this in a running app, only read the code and the two
screenshots.

## The fix

Make "the deck decides" mean a deck decides, not "the criterion is not title".

- **Modal lock only for a manual deck.** In `study/index.vue`, pass
  `required-categories` to the modal only when `scope.type === "created"` and
  its criterion is not `title`. Anime name off in an all / artist / anime
  session shows the normal toggle view, so it can be turned back on.
- **Created deck graded on title:** the server already ignores the Anime-off
  preference there, so lock the Anime name row on in the modal with a short
  reason ("A deck always asks the anime title") instead of showing a toggle
  that does nothing. The stored preference is never rewritten, as today.
- **Chip copy:** "Graded on: ..." stays for a deck, and for an Anime-off
  session reads as the session's own choice (still `describeCriterion`'s
  name, no change to its output).
- **Hint overlap:** in the primary song and artist boxes
  (`StudySongAnswer.vue`, `StudyArtistAnswer.vue`) show the idle hint as an
  in-flow line under the input row, full width, instead of the absolute
  overlay. Loading, error and no-match statuses use the same line. Secondary
  (non-primary) boxes keep today's overlay, since their status is short and
  must not resize the overlay.

**Must not break:** title-graded sessions render exactly as before; scheduling,
tracks and the server are untouched; the stored category preference is not
rewritten; Typed Answers off still grades the anime title.

## Build steps

- [x] **1. Modal lock and chip** - add a small pure helper (for example
  `deckDecidesCategories(scope, criterion)` in `app/utils/criterionGrading.ts`)
  with a Vitest test: created + non-title true, created + title false (anime
  row locked separately), all/artist/anime with any criterion false. Use it in
  `study/index.vue` to decide the `required-categories` prop, and update the
  modal for the created-title case.
  *Done when:* with Anime name off in an all-cards session the modal shows
  four toggles and Anime name can be turned back on; in a song-graded manual
  deck it still shows the locked list; in a title-graded manual deck the Anime
  name row is locked on.
- [x] **2. Hint overlap** - move the primary idle hint in
  `StudySongAnswer.vue` and `StudyArtistAnswer.vue` into the flow, wrapped
  under the input row.
  *Done when:* at the width in the screenshot, the label, placeholder, input
  and Give up button are all readable and the hint sits on its own line;
  non-primary boxes are unchanged.

## Verify

1. `bun run test` and `bun run build` in `nuxt-app/`.
2. `bun run dev`, `/study` with Typed Answers on: open Answer categories,
   turn Anime name off, reopen it. Toggles still there, Anime name can be
   turned back on, and the round returns to the anime box.
3. With Anime name off and Song + Artist on, read the player at about 1750px
   and 600px wide: no text overlaps. Use `bun run measure /study --select
   .song-answer` if the overlap needs a number.
4. `/study?type=created&id=<song deck>`: modal shows the locked list. A
   title-graded deck: Anime name row locked on.
