# Party reveal facts for catalog songs

**Type:** Fix
**Status:** verified (tests and build; display check left to the user)

## The problem

The party display's reveal card shows a facts line (season and year, format,
studios, AniList score) and tags under the answer. Library songs fill it from
the stored anime row, but songs pulled from AnisongDB (outside-library endless,
or a catalog search in Add songs) were queued with `EMPTY_ANSWER_FACTS`, so the
line was blank for them. Their lightning clue and tag hints were empty too.

## The fix

- `parseAnimeVintage` (`server/utils/partyAnswerFacts.ts`) reads AMQ's
  `animeVintage` label ("Fall 2013") into season and year, set on the catalog
  item as soon as it is queued.
- Catalog queue items carry `catalogAniListId`. After any queue change the
  store's `fillCatalogFacts` fills `details` and `answer.facts`: from the
  library's `anime` row when it has checked details, else one batched
  `fetchAnimeDetailsByIds` request. Results are cached per session (null when
  AniList has no entry); AniList being down or offline mode keeps season and
  year only.
- Hiding the anime in the reveal settings still blanks the facts.

## Verify

- `bun run test` (2,884 passed) and `bun run build`.
- Manual: start an outside-library endless game and reveal a song; the display
  shows a line such as `Spring 2019 · TV · MAPPA · 78%`.
