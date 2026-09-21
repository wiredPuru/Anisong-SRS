# Feature: Library filter + bulk cleanup (no AnimeThemes.moe match)

**From build-plan:** feature 70a
**Status:** verified

## Goal

Let the user identify and remove cards on `/cards` whose theme has no
AnimeThemes.moe match at all (resolved purely via AnisongDB), so someone who
trusts AnimeThemes.moe's curation more than AnisongDB's broader catalog can
prune what AnisongDB added on its own - without touching which host actually
serves any card's clip (Clip source, feature 64, is untouched; this is about
which cards are visible/selectable, never about playback).

## Design reference

None needed. This reuses two already-built UI patterns unchanged: `/cards`'
existing search box + infinite scroll (feature 35a) and its "Delete all N
matching" bulk-delete bar (feature 61c). The only new UI is one toggle control
next to the search input.

## In scope

- A `missingAnimeThemesMatch` filter condition (`isNull(song.animethemesThemeId)`),
  ANDed onto the existing text-search condition when active, threaded through
  `listCards` and `listCardIds` (`server/utils/cards.ts`).
- `GET /api/cards` and `GET /api/cards/ids` accept a `missingAnimeThemes=1`
  query param alongside the existing `q`.
- `/api/cards/ids`'s "must have a filter" safety guard (today: `q` alone)
  loosens to "`q` is non-blank, or `missingAnimeThemes=1`, or both" - it still
  refuses the request when neither is present, so it can never accidentally
  match the whole library.
- A toggle on `/cards` (e.g. "No AnimeThemes match"), ANDed with any active
  text search, round-tripped through a `?missingAnimeThemes=1` query param the
  same way `?q=` already round-trips (read on mount + `watch`, same pattern
  `applyQueryParam` already uses).
- The "Delete all N matching" bar's visibility condition loosens from "a text
  search is active" to "a text search or the toggle is active," and
  `deleteAllMatching()` passes `missingAnimeThemes` alongside `q`.
- A distinct empty-state message for "toggle on, no text search, zero matches"
  (today's `v-else` branch is the *true* empty-library state with the mascot,
  which would be misleading here - the library isn't empty, nothing just
  happens to lack a match).
- Toggling the filter clears the current checkbox selection, the same way
  changing the search text already does.

## Out of scope

- Deck-detail views (`/decks`) - unaffected. This is a `/cards`-library-only
  surface, same as feature 61b/61c's bulk-select UI before it;
  `listCardsByArtist`/`listCardsByAnime`/`listCardsByManualDeck` are not
  touched, and `cardSearchCondition`'s new option is optional so those callers
  keep working unmodified.
- Any change to Clip source (feature 64) or which host serves a card's
  video/audio.
- Any change to import/search behavior for *new* cards - an AnisongDB-only
  result in the Anime/Song/Artist add-candidate groups is unaffected here.
  That's feature 70b, a separate sub-feature.
- Any schema change - `Song.animethemesThemeId` already exists and is already
  populated correctly (or left null) by every import path (anime, song, and
  artist import all hit the same `resolveThemes()` "anisongdb"-only branch).

## Build steps

- [x] **Step 1 - Server: filter support + tests** - In `server/utils/cards.ts`,
  add `isNull` to the drizzle import and extend `cardSearchCondition` to accept
  an optional `missingAnimeThemesMatch?: boolean` that ANDs in
  `isNull(song.animethemesThemeId)`; thread it through `listCards` and
  `listCardIds`. In `server/utils/cardDelete.ts`, add a small pure helper (e.g.
  `hasAnyCardsIdsFilter(q: string | null, missingAnimeThemesMatch: boolean): boolean`)
  that `/api/cards/ids` uses for its 400 check instead of `q` alone. Wire
  `server/api/cards.get.ts` and `server/api/cards/ids.get.ts` to parse
  `query.missingAnimeThemes === "1"` and pass it through. *Done when:*
  `bun run test` passes new cases in `cardDelete.test.ts` (the "at least one
  filter" gate: rejects blank `q` + `false`, accepts blank `q` + `true`,
  accepts real `q` + `false`) and a direct check that `listCards`/`listCardIds`
  with the flag set return only cards whose song has a null
  `animethemesThemeId` (verified against real library data via the running
  dev server or a focused test).
- [x] **Step 2 - Client: toggle wired into the library list** - In
  `app/pages/cards/index.vue`, add a `missingAnimeThemesMatch` ref and a
  toggle control next to the search input; include it in `loadFirstPage`/
  `loadMore`'s `/api/cards` query and in the `searchQuery` watcher (extend to
  watch both refs, still calling `clearChecked()` + resetting
  `confirmingDeleteMatching`). Round-trip it through `?missingAnimeThemes=1`
  the same way `applyQueryParam`/`route.query.q` already round-trip `?q=`.
  Add a distinct empty-state line for "toggle on, no results" instead of
  falling through to the true-empty-library mascot state. *Done when:*
  toggling it on `/cards` narrows the visible list to only cards with no
  AnimeThemes.moe match (checked against a card known to be AnisongDB-only),
  toggling off restores the full list, loading `/cards?missingAnimeThemes=1`
  directly opens into the filtered view, and an all-matched library shows the
  new "no unmatched cards" message rather than the mascot empty state.
- [x] **Step 3 - Client: bulk-delete parity** - Change the "Delete all N
  matching" bar's `v-if` from gating on `searchQuery` alone to gating on
  `searchQuery || missingAnimeThemesMatch`; update `deleteAllMatching()` to
  pass `missingAnimeThemes` alongside `q` to `/api/cards/ids`. *Done when:*
  with only the toggle on (no typed search), the bar appears, its confirm
  step successfully bulk-deletes exactly the filtered set, and the count
  matches before/after.

## Files / areas

- `nuxt-app/server/utils/cards.ts` - `cardSearchCondition`, `listCards`,
  `listCardIds`
- `nuxt-app/server/utils/cardDelete.ts` - new filter-gate helper
- `nuxt-app/server/utils/cardDelete.test.ts` - new test cases
- `nuxt-app/server/api/cards.get.ts` - parse + pass `missingAnimeThemes`
- `nuxt-app/server/api/cards/ids.get.ts` - parse + pass `missingAnimeThemes`,
  updated 400 condition
- `nuxt-app/app/pages/cards/index.vue` - toggle, query round-trip, empty
  state, bulk-delete bar condition

## Data / contracts

- New query param `missingAnimeThemes` (string `"1"` = true) on
  `GET /api/cards` and `GET /api/cards/ids`, alongside the existing `q`.
- `/api/cards/ids` 400s only when `q` is blank/absent **and**
  `missingAnimeThemes` is not `"1"`.
- No schema change - reads the existing `Song.animethemesThemeId` column,
  already nullable and already populated correctly by every import path.

## Testing

Vitest is configured, so the logic-test gate is on.

- Step 1's filter-gate helper (`hasAnyCardsIdsFilter`) is in-scope pure logic
  (a boolean decision with clear right/wrong answers) and shipped 4 tests in
  the same diff (`cardDelete.test.ts`), following the existing
  `parseDeleteBody`/`parseMatchingQuery` precedent.
- `cardSearchCondition`/`listCards`/`listCardIds` themselves stay untested
  directly (same as before - thin DB-query wrappers with no existing test
  coverage in this file); verified instead against the real dev database:
  103 of 151 cards had a null `song.animethemes_theme_id`, matching both
  `/api/cards?missingAnimeThemes=1` and a direct `sqlite3` count.
- Steps 2-3 (UI/integration) were verified live via `playwright-cli` against
  the running dev server: toggle narrows 151 -> 103 and back, direct
  `?missingAnimeThemes=1` URL load opens pre-filtered, search takes
  precedence over the toggle for the empty-state message, and the toggle-only
  "Delete all N matching" flow deleted exactly the 103 filtered cards
  (verified before/after counts) without requiring any typed search.
  The toggle-only zero-result empty state and the toggle-only bulk-delete
  flow were both verified against a throwaway copy of the database (a
  temporary instance pointed at a copy via `GAQ_SRS_DATA_DIR`), never
  mutating the real library - confirmed intact (151 cards) afterward.

## Outcome

Built and merged 2026-09-21. `bun run test` (609/609 passing) and
`bun run build` both green throughout. No P0/P1 findings were open or fixed
at completion; the ledger's existing P2/P3 entries (F-14, F-15, F-16, F-17)
are unrelated to this feature and were left in place.
