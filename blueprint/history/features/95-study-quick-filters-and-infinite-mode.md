# Study scope quick-filters + infinite mode

**Type:** Feature (build-plan item 95, sub-features 95a-95b)
**Status:** verified

## Goal

Make the "openings only" session filter obvious on `/study` and `/decks`
without altering the deck, and let a user keep studying past what is due.

## Decisions

- Infinite mode is practice only: no `ReviewLog` row, no box, streak, or due
  date change. Due cards still review normally; only the extra cards are
  practice.
- Order: due first, then least recently reviewed; suspended and buried cards
  stay out.

## Built

- 95a: `StudyThemeChips.vue`, `activeThemeChip`/`withThemeChip`/
  `parseThemesParam` in `app/utils/studyFilters.ts` (tested), `?themes=` on
  `/study`, "Openings only"/"Endings only" on `/decks`.
- 95b: `getPracticeCard`/`pickPracticeId` (tested, incl. an in-memory DB test),
  `practice=true` on `/api/study/next`, `infinite`/`practice` in
  `useStudySession`, header toggle and caught-up button.

## Verification

`bun run test` (1654 passing) and `bun run build`. Not exercised in a browser.
