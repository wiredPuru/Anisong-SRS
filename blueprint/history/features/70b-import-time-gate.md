# Feature: Import-time gate for cards with no AnimeThemes.moe match

**From build-plan:** feature 70b (parent: 70. Filter cards without an AnimeThemes.moe match)
**Status:** verified

## Goal

70a lets the user find and bulk-delete cards whose song has no AnimeThemes.moe
match (`Song.animethemesThemeId` is null). Without a gate at the add step, that
filter would refill as fast as it is emptied. 70b makes every add-candidate
surface refuse a theme with no AnimeThemes.moe match: the row shows disabled
with a note saying why, exactly the shape feature 64b gave `clipBlocked`.

Nothing here touches Clip source (feature 64) or which host serves a clip.

## Finding that shapes this spec

The match is only *free* on the anime path: `resolveThemes()` already queries
AnimeThemes.moe and AnisongDB in parallel. Song and artist results from
AnisongDB carry `animethemesThemeId: null` by construction (`songSource.ts`,
`artistSource.ts`), so gating on that field literally would disable every
result in those two groups. They need a real per-anime AnimeThemes.moe lookup
(`fetchAnimeThemesByAniListId`, roughly 0.75s each), paired to a song by
`titleKey` exactly as `resolveThemes` already pairs, never by slot (the two
providers number slots differently). The user chose to cover all surfaces in
this one feature rather than split.

As a side effect, a song or artist import that finds a match now also stores
the AnimeThemes.moe theme id on the `Song`, which makes 70a's filter more
accurate for newly added cards. Existing rows are not backfilled.

## In scope

- A shared match lookup in `server/utils/themeSource.ts`: fetch one anime's
  AnimeThemes.moe themes once, build a `titleKey` -> theme id index, and answer
  "does this song title match" from it. Reuses `fetchAnimeThemesByAniListId`
  and `titleKey`. Artist import adds one lighter batched query
  (`fetchThemeTitlesByAniListIds`, titles and ids only) because a request per
  anime was too slow for a large catalog.
- `resolveThemes()` reports `animethemesUnavailable` so the anime route can tell
  "no match" from "AnimeThemes.moe was unreachable".
- `noAnimethemesMatch: boolean` on every add-candidate theme/result shape, set
  server-side in:
  - `POST /api/lookup/import` (anime; free, from the resolved theme plus the
    stored `Song` row)
  - `POST /api/lookup/song-import` (song; one lookup at click time)
  - `POST /api/lookup/artist-import` (artist; batched lookups, about 40 anime
    per request)
- Surfacing it as disabled Add plus a note in all five theme-picking surfaces:
  `CardAddAnimeResults.vue`, `CardImportListResults.vue` (feature 58's list
  import; it reuses `/api/lookup/import` and 64b never gave it a note),
  `DeckAddAnimeModal.vue`, `CardAddSongResults.vue`, `CardAddArtistResults.vue`.
- "Add all" (anime, list-import, artist) skips a gated theme without counting it
  as added or failed, the way 64b made artist "Add all" skip `clipBlocked`.
- `song-import` returns the flag instead of a usable result, so a card cannot be
  created for an unmatched song through that path even if the client is stale.

## Resolved decisions

- **Outage fails open.** If AnimeThemes.moe is unreachable
  (`ProviderUnavailableError`) the theme is *not* gated: we cannot tell "no
  match" from "cannot check", and blocking everything during an outage would be
  worse than admitting a few unmatched cards that 70a can later clean up.
- **A stored id counts as a match.** In the anime and artist routes the gate is
  evaluated on the `Song` row after `upsertSong`, which keeps any id an earlier
  import stored (it drops null keys). A song matched once is never gated later
  just because a sparser provider answered this time.
- **No local-file escape hatch, unlike 64b.** 64b left Add enabled in the Anime
  group because a typed local path is a real way to finish a card. That does not
  apply here: the card would still have no AnimeThemes.moe match. Add disables
  in every group.
- **Song gating happens at click, not at search.** Checking every search result's
  anime up front would fan out to many AnimeThemes.moe calls per keystroke. The
  one-click Add fires the import, learns the answer, and the row flips to
  disabled with the note (remembered per `resultKey` for the session).
- **Only a client gate for anime and artist.** `POST /api/cards` is not changed:
  it also serves deck import, whose manifests carry their own ids, and any
  server-side rule there would break re-import. Song-import is the one server
  refusal because it owns the lookup.

## Out of scope

- Any Clip source change (feature 64), or which host plays a clip.
- Backfilling `animethemesThemeId` on existing songs, or a "re-check matches"
  action.
- A setting to turn the gate off.
- Guarding `POST /api/cards` or deck import (`importBundle`).
- `source-refresh.post.ts` (60c re-source) and existing cards.
- Changing `resolveThemes()`'s merge rules or provider preference.
- The `/cards` 70a filter itself.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Match lookup helpers (pure logic + test)** - in
  `themeSource.ts` add `loadAnimeThemesMatchIndex(aniListId)` (calls
  `fetchAnimeThemesByAniListId`, returns `{ status: "ok", animethemesId, byTitle }`
  or `{ status: "unavailable" }` on `ProviderUnavailableError`, rethrows anything
  else) and a pure `findThemeMatch(index, songTitle)` returning the theme id or
  `null`. Add `animethemesUnavailable: boolean` to `ResolvedThemes`. Extend
  `themeSource.test.ts`. *Done when:* `bun run test` passes cases: title matches
  across accent/spacing/case differences; a real spelling difference returns
  `null`; the same title on a different slot still matches; anime with no
  AnimeThemes.moe entry returns `ok` with an empty index; `ProviderUnavailableError`
  returns `unavailable`; a non-outage error rethrows; `resolveThemes` sets
  `animethemesUnavailable` true only when the AnimeThemes.moe half was an outage.
- [x] **Step 2 - Gate helper (pure logic + test)** - one small function in
  `themeSource.ts` (or `themeSource` sibling) `isMissingAnimeThemesMatch({ storedThemeId, unavailable })`
  returning `true` only when there is no id and the provider was reachable, so
  all three routes share one definition of the fail-open rule. *Done when:*
  tests cover id present, id null + reachable, id null + unavailable.
- [x] **Step 3 - Anime import + three anime-shaped UIs** - `import.post.ts` adds
  `noAnimethemesMatch` to each theme from `songRow.animethemesThemeId` and
  `resolved.animethemesUnavailable`. `CardAddAnimeResults.vue`,
  `CardImportListResults.vue` and `DeckAddAnimeModal.vue` disable Add and show a
  note under a gated theme; `addAllThemes()` skips them. *Done when:* `POST
  /api/lookup/import` for an anime AnimeThemes.moe does not know returns every
  theme with `noAnimethemesMatch: true`, and for a fully matched anime returns
  all `false` (curl against dev server, both cases recorded). In the browser,
  `/cards` -> Anime group -> expand shows a disabled Add plus note on a gated
  theme, "Add all" on a mixed anime adds only matched themes and reports no
  failure, and the same holds in the list-import flow and a manual deck's "Add
  new anime" modal.
- [x] **Step 4 - Song import gate + Song UI** - `song-import.post.ts` uses the
  body's `animethemesThemeId` when present; otherwise loads the match index for
  the anime and looks the song up by title, storing the found id on the `Song`.
  It returns `noAnimethemesMatch` (and no `existingCard`). `CardAddSongResults.vue`
  handles the flag: no card is created, the row is marked disabled with the note
  for the rest of the session. *Done when:* `POST /api/lookup/song-import` for an
  AnisongDB-only song returns `noAnimethemesMatch: true` and the `Song` row keeps
  a null id; for a song AnimeThemes.moe has (with a different slot label than
  AnisongDB) it returns `false` and the `Song` row now holds the AnimeThemes.moe
  theme id. In the browser, clicking Add on an unmatched Song result creates no
  card and the row becomes disabled with the note; a matched result still adds
  in one click.
- [x] **Step 5 - Artist import gate + Artist UI** - `artist-import.post.ts`
  starts one batched match lookup for every anime that has any entry with a null
  id (`startMatchIndexLoads`, backed by a new `fetchThemeTitlesByAniListIds` that
  sends up to 40 AniList ids per AnimeThemes request), fills each entry's id from
  its anime's index before `upsertSong`, then sets `noAnimethemesMatch` via the
  Step 2 helper. *Revised during the build:* the spec first called for one
  lookup per anime with bounded concurrency, but measured on Nana Mizuki (70
  anime) that added about 20s to a 6s import, past this step's own stop
  condition; one batched request per chunk measured about 2s per chunk and
  added under 2s. `CardAddArtistResults.vue` disables Add and shows the note;
  `addAllThemes()` skips gated themes like it skips `clipBlocked`. *Done when:*
  artist import for an AnisongDB-sourced artist returns matched themes with
  `noAnimethemesMatch: false` and their `Song` rows hold ids, and unmatched ones
  `true`; an `animethemes`-sourced artist (fallback path) needs no lookups and
  returns all `false`. Wall-clock for an artist with 30+ anime is recorded before
  and after and grows by less than half. In the browser, the artist modal shows
  disabled rows with the note and "Add all" skips them without a failure count.
- [x] **Step 6 - Whole-feature check** - run the full gate and one end-to-end
  pass. *Done when:* `bun run test` and `bun run build` in `nuxt-app/` pass; in
  the browser, adding an unmatched theme is impossible from all five surfaces,
  70a's "No AnimeThemes match" filter shows no new cards after a fresh
  song/artist/anime import session, and an AnimeThemes.moe outage (simulated by
  blocking the host) leaves Add enabled rather than disabling everything.

## Files / areas

- `nuxt-app/server/utils/themeSource.ts`, `nuxt-app/server/utils/themeSource.test.ts`
- `nuxt-app/server/api/lookup/import.post.ts`
- `nuxt-app/server/api/lookup/song-import.post.ts`
- `nuxt-app/server/api/lookup/artist-import.post.ts`
- `nuxt-app/app/components/card/CardAddAnimeResults.vue`
- `nuxt-app/app/components/card/CardImportListResults.vue`
- `nuxt-app/app/components/card/CardAddSongResults.vue`
- `nuxt-app/app/components/card/CardAddArtistResults.vue`
- `nuxt-app/app/components/deck/DeckAddAnimeModal.vue`

## Data / contracts

- Load-bearing:
  ```ts
  type AnimeThemesMatchIndex =
    | { status: "ok"; animethemesId: number | null; byTitle: Map<string, number> }
    | { status: "unavailable" };
  function loadAnimeThemesMatchIndex(aniListId: number): Promise<AnimeThemesMatchIndex>;
  function findThemeMatch(index: AnimeThemesMatchIndex, songTitle: string | null): number | null;
  function startMatchIndexLoads(aniListIds: number[], options?): Map<number, Promise<AnimeThemesMatchIndex>>;
  function isMissingAnimeThemesMatch(args: { storedThemeId: number | null; unavailable: boolean }): boolean;
  ```
- `ResolvedThemes` gains `animethemesUnavailable: boolean`.
- `noAnimethemesMatch: boolean` is added, server- and client-side (hand-duplicated
  per the F-09 convention), to: the anime `ThemeResult` (duplicated in
  `CardAddAnimeResults`, `CardImportListResults`, `DeckAddAnimeModal`), the
  `song-import` response, and the artist-import theme entry. It is separate from
  `clipBlocked`; a theme can carry both.
- No schema or migration change. `Song.animethemesThemeId` already exists; this
  feature writes it more often (song and artist import) and reads it.

## Testing

- Vitest is configured. Steps 1 and 2 ship tests in `themeSource.test.ts`
  (mock `fetchAnimeThemesByAniListId` as the existing tests do).
- Steps 3-5 are route and component surfaces: curl against the dev server plus
  browser evidence, not new unit tests. Record the before/after artist-import
  timing in Step 5.
- Final gate: `bun run test` and `bun run build` in `nuxt-app/`.

## Notes for the AI

- Pair by `titleKey`, never by slot. `resolveThemes` documents why (BanG Dream!
  Ave Mujica's ED1 vs Ending 2). A real romanization difference deliberately
  fails to match and is therefore gated; do not add fuzzy matching.
- Reuse the 64b pattern for markup: `.clip-blocked-hint` class, the
  `NuxtLink to="/settings"` style note, `row-clickable` off while disabled. The
  note here has no settings link (there is no setting); wording along the lines
  of "Not on AnimeThemes.moe, so it cannot be added." Add a sibling class or
  reuse `.clip-blocked-hint` rather than inventing new styling.
- Do not read `clipBlocked` and `noAnimethemesMatch` as one condition. Add is
  disabled if either is set in the surfaces where `clipBlocked` already disables
  it, and the anime-shaped surfaces now also disable for `noAnimethemesMatch`.
- The artist loop is already sequential and slow per anime (AniList metadata).
  Start the match lookups concurrently ahead of, or alongside, that loop rather
  than adding a second sequential round-trip per anime.
- Server routes stay the only place that calls providers; components only call
  routes with `$fetch`. No hard-coded colors, no inline styles, no em dashes.
