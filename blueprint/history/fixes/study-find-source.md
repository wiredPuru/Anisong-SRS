# Fix: unplayable Study cards offer a way out, and Edit card opens in view

**Type:** Fix
**Status:** verified
**Branch:** `fix/study-find-source`

Built ad hoc in chat on 2026-10-04 and archived retroactively by `/complete`,
the same way features 39 and 40 were. There was no `/fix` spec beforehand.

## The problem

1. On a short window, `/study`'s Edit card form opened below the info panel
   inside a scrolling column, so it was open but entirely off screen.
2. A card whose clip cannot load (for example one holding only an
   animethemes.moe URL while Clip source is AnisongDB only) showed an error
   with nothing to do about it: no way to find an equivalent source, skip the
   card for the session, or drop it from the deck being studied.

## The fix

- `StudyCardEditPanel` scrolls its form into view after it opens, by button or
  by the `E` hotkey.
- `POST /api/cards/source` (`applyCardSource`, `server/utils/cardSource.ts`)
  replaces only the clip URL kinds the chosen result carries. It refuses a URL
  the Clip source setting excludes (403) and leaves local files untouched.
- `GET /api/cards/source-search?q=&animeAniListId=` searches AnisongDB and
  AnimeThemes.moe together (unlike the add-card song search, which only falls
  back), puts same-anime results first, and marks results the Clip source
  setting blocks.
- `StudyFindSourceModal` is the picker. Its first search retries on the title
  before a `(` when nothing usable comes back, since the providers disagree on
  version suffixes ("Go Nin Ver." vs "5-nin Ver.").
- `StudyMediaPlayer` gained an `error-actions` slot. `/study` fills it with
  `StudyCardTroubleActions`: Find another source, Skip for this session (the
  existing Bury), and Remove from the deck (manual decks only, through
  `DELETE /api/decks/cards`).
- The Edit card form has Find another source and Remove from the deck too.
- After a swap, only the two clip URLs are merged into the current card, since
  the response carries the title track's box and streak.

Not done: Preview (`CardPreviewModal`) does not get the failed-clip actions.

## Verify

1. Study a manual deck holding a card whose only source is blocked. The error
   shows Find another source, Skip for this session, and Remove from <deck>.
2. Find another source lists AnisongDB and AnimeThemes.moe results, same anime
   first, blocked ones disabled. Use this swaps the clip and it plays.
3. Skip buries the card for the session. Remove takes it out of the deck only.
4. At a short window, E opens Edit card with the form in view.

## Evidence

- `bun run test`: 123 files, 1728 tests pass (`cardSource.test.ts` covers
  `parseApplySourceBody`). `bun run build` completes.
- Browser (playwright-cli, 1280x600) on deck 88: the three buttons render on
  the failed clip, the Edit form's top sat at 145px, and the picker listed
  usable AnisongDB results after the shortened-title retry.
- `POST /api/cards/source` with a non-allowed host returns 403. "Use this" and
  "Remove from deck" were not clicked against real data.
