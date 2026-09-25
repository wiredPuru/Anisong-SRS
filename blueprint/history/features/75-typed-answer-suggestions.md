# Feature: Suggestions for every typed answer box

**From build-plan:** feature 75
**Status:** verified

## Goal

Make the Song name and Artist answer boxes on Study reliably offer useful
suggestions while typing, alongside the existing anime-title autocomplete.
Selecting a suggestion fills the answer only; the existing grading and submit
flow stays in charge. Suggestions must not reveal another answer required in
the same round.

## In scope

- Reproduce and fix the reported missing Song name dropdown. Trace the current
  search path from `StudySongAnswer` through its composable and
  `/api/lookup/song-answer-search`, and check whether results are empty,
  errors are hidden, or the list is clipped by the player overlay. Keep the
  existing providers and search behavior unless the evidence identifies the
  broken link.
- Add Artist autocomplete to `StudyArtistAnswer`, using the existing artist
  search providers and the same two-character floor, debounce, latest-request
  handling, result cap, and loading/error behavior as the other typed-answer
  searches.
- Add a narrowly redacted Artist answer response containing only an internal
  key and artist name. It must not return song titles, anime titles, anime
  IDs, theme slots, or media URLs.
- Hide the artist subtitle on Song suggestions whenever Artist is also a
  required answer in the current round. The song title remains selectable.
- Support keyboard and mouse suggestion selection without changing free-text
  answers, grading, scores, SRS scheduling, or submission behavior.
- Verify that both dropdowns remain visible and usable in the Study overlay,
  including the narrow layout where the answer stack moves to the top of the
  player frame.

## Out of scope

- Changes to answer normalization, aliases, grading rules, score values,
  review logging, or SRS scheduling. Suggestions remain optional aids, not
  accepted answers by themselves.
- Changes to anime-title autocomplete or the Opening/Ending picker.
- New providers, provider ranking, or library-wide search behavior. Artist
  lookup reuses `searchArtistCandidates`; Song lookup keeps its current
  AnisongDB-first / AnimeThemes fallback path.
- Suggestions outside the Study typed-answer boxes.
- Any database, migration, saved setting, or project-plan change.

## Design reference

Use the existing `StudyTypedAnswer` and `StudySongAnswer` comboboxes as the
interaction and visual reference. This feature extends those patterns; it is
not a visual replication of an external design.

## Build loop

Build one step at a time. Show each diff, explain it briefly, and stop for
review before moving on. The feature-level commit belongs to `/complete`.

## Build steps

- [x] **Step 1 - Reproduce and repair Song suggestions** - follow the reported
  Song name + Artist round from the Study input through `useSongAnswerSearch`,
  `GET /api/lookup/song-answer-search`, and the rendered list. Separate a
  provider empty/error response from a client or layout failure, then make the
  smallest evidence-led correction in the route, composable, component, or
  overlay positioning. If AnisongDB's valid empty result is the cause and
  AnimeThemes has matches, add that provider fallback on empty results and
  cover it with tests. Keep typed free-text usable when search has no results
  or is unavailable. Add regression coverage for any logic changed.
  *Done when:* with a controlled non-empty response, typing at least two
  characters in both a Song bonus box and a Song-primary box visibly opens
  selectable results; arrow keys, Enter, Escape, and mouse selection work;
  the list is not clipped at the normal and narrow Study sizes. Empty results
  and a failed request show their existing clear status and still permit a
  typed answer. The browser evidence identifies the original failure point;
  `bun run test` and `bun run build` pass.

- [x] **Step 2 - Redacted Artist answer search** - add
  `server/utils/artistAnswerOptions.ts` with a narrow source type and a mapper
  that trims, drops blank names, deduplicates, caps results at 10, and returns
  only `{ key, artistName }`. Add
  `GET /api/lookup/artist-answer-search?q=` using the existing
  `searchArtistCandidates()` provider/fallback behavior, and
  `app/composables/useArtistAnswerSearch.ts` using `useAnswerSearch`. Keep the
  client response mirror in the same field order as the server contract.
  *Done when:* mapper tests cover blank, duplicate, and capped results and
  prove no song, anime, ID, slot, or media fields can pass through; the route
  rejects an empty `q` with 400 and returns only `{ key, artistName }`; the
  composable uses the shared two-character, debounce, stale-request, and
  error behavior; `bun run test` and `bun run build` pass.

- [x] **Step 3 - Artist combobox and cross-answer safety** - extend
  `StudyArtistAnswer.vue` with the Artist search combobox, loading / empty /
  failure feedback, mouse selection, and the same Arrow, Enter, Escape, and
  IME handling as the sibling boxes. Selecting a result fills the field but
  never grades or submits it. Preserve primary-mode Submit / Give up, focus,
  and playback behavior; in a bonus row, Enter must not submit the round.
  Pass whether Artist is required into `StudySongAnswer` and do not render
  `artistName` in its suggestion rows in that case. Do not expose the hidden
  subtitle only through CSS or accessibility attributes.
  *Done when:* in title+song+artist, title+artist, song+artist, and artist
  decks, each applicable box shows only suggestions for its own answer; Song
  results omit the artist whenever Artist is required and retain it when
  Artist is not required, while Artist results contain no song or anime
  details. Picking either suggestion only fills the
  answer; the existing submit path still grades it. Free-text answers,
  primary/bonus Enter behavior, disabled state, IME input, and page hotkey
  guards remain intact. Browser checks cover loading, no results, provider
  failure, hidden Artist spoiler, and 390px layout with no clipped or
  unreachable list; `bun run test` and `bun run build` pass with no console
  errors.

## Files / areas

| File | Why |
|---|---|
| `app/components/study/StudySongAnswer.vue` | Repair the reported dropdown path and hide the artist subtitle when Artist is required. |
| `app/components/study/StudyArtistAnswer.vue` | Add Artist suggestions while preserving primary and bonus answer behavior. |
| `app/composables/useArtistAnswerSearch.ts` (new) | Artist search client on the shared debounced/latest-request helper. |
| `app/composables/useAnswerSearch.ts` | Reuse as-is unless Step 1 evidence proves a shared defect. |
| `server/utils/artistAnswerOptions.ts` + `.test.ts` (new) | Narrow, redacted response mapping and unit coverage. |
| `server/api/lookup/artist-answer-search.get.ts` (new) | Read-only Artist answer suggestion endpoint. |
| `app/pages/study/index.vue` | Pass the current required-Artist state to the Song box; preserve existing wiring and grading. |

No schema, migration, or stored-data change.

## Data / contracts

**Load-bearing Artist response** (server declared in
`server/utils/artistAnswerOptions.ts`, client mirror in
`app/composables/useArtistAnswerSearch.ts`):

```ts
interface ArtistAnswerOption {
  key: string;
  artistName: string;
}
```

`GET /api/lookup/artist-answer-search?q=<query>` returns
`{ results: ArtistAnswerOption[] }`. Do not add source IDs, song titles, anime
titles or IDs, theme slots, or media URLs. Suggestions guide the Artist field
only; they never represent a grading verdict.

The existing Song contract remains `{ key, songTitle, artistName }`. When the
current round requires Artist, the Song component must not render its
`artistName` field. This is conditional omission from the rendered suggestion,
not just visual hiding.

## Testing

`bun run test` is configured, so new pure mapping/search logic needs colocated
tests in the same step. Keep UI and integration evidence in the browser rather
than adding a component-test framework. Cover:

- Artist response mapping: trimming, empty names, duplicate names, result cap,
  and exact redacted keys.
- Artist route validation and provider mapping; retain the existing
  `searchArtistCandidates` fallback/error behavior.
- Search lifecycle regressions: minimum query, debounce, stale response,
  empty results, and provider failure where a focused test is practical.
- Browser flows for Song and Artist as main and bonus answers, with co-required
  answers, selection without implicit submit, keyboard/mouse/IME behavior,
  provider states, redaction, and narrow layout.

## Notes for the AI

- Start Step 1 with evidence. `StudySongAnswer` already renders a dropdown and
  calls a working search route, so do not rewrite it before locating whether
  the reported failure is upstream results, request state, or player-frame
  clipping.
- Anime and Song answer boxes already use `useAnswerSearch`; Artist should
  reuse it rather than copy debounce and stale-request logic.
- Keep the Artist endpoint's result shape deliberately smaller than
  `ArtistCandidate`. The UI needs the name and a stable list key only.
- Typing remains valid when suggestions are absent. A selected suggestion
  does not bypass the user's existing submit action or change how answers are
  graded.
- No em dashes in code comments, commit messages, or spec updates.
