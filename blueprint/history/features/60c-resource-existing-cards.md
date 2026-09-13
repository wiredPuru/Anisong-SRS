# Feature: Re-source existing remote-only cards

**From build-plan:** feature 60c
**Status:** verified

## Goal

Give the cards that already exist the speed win 60a and 60b gave new ones. A
Settings action walks every card that still streams from animethemes.moe with no
local copy, re-asks AnisongDB for the same song, and swaps the stored clip URL to
AMQ's distribution host wherever the two providers confidently agree on which
song it is. Without it, only cards added after 60a/60b benefit, and an existing
library keeps paying animethemes.moe's 1-3s media TTFB forever.

## In scope

- A candidate rule, shared by the count the user sees and the set that actually
  gets rewritten: a card qualifies for a kind (video or audio) when its stored
  URL for that kind is on `animethemes.moe` **and** its local path for that kind
  is null.
- `server/utils/cardSourceRefresh.ts`: candidate selection, the count, the
  stored-song-to-AnisongDB-theme pairing rule, and the run loop.
- One AnisongDB resolution per **anime**, not per card, reusing
  `fetchThemesByMalId` from 60a unchanged.
- Pairing on normalized song title (`titleKey`), never on theme slot. Slot is
  only a tie-break between two AnisongDB themes that share a title key.
- `POST /api/lookup/source-refresh`, streaming per-anime progress through the
  existing `respondWithImportProgress` NDJSON mechanism.
- A `animethemesSourcedCardCount` field on `GET /api/media-library`.
- `SettingsCardSourceControl.vue` in `/settings`' Media library section,
  modelled directly on `SettingsCoverArtControl.vue`.

## Out of scope

- **Filling a kind a card does not already have.** If a card has a video URL and
  no audio URL, AnisongDB's audio for it is not added. This action re-sources,
  it does not enrich: adding a kind changes what the card can do (feature 43's
  Audio only would start working on it), which is a different decision from
  making an existing source faster.
- **Cards with a local file for that kind.** Already local, already fast.
- **Verifying the new URL with a HEAD request before writing it.** Deliberate:
  these are the same URLs, from the same API response shape, that 60a and 60b
  store on every newly added card with no verification. Feature 42's
  download-on-failure fallback is the recovery path either way.
- **Keeping the old URL.** No schema migration, no undo. Re-adding a card is the
  escape hatch, same as today.
- **Re-resolving song or anime metadata.** Titles, native titles, artists,
  `animethemesThemeId` and `animethemesId` are untouched. This writes exactly two
  columns, `card.animethemesVideoUrl` and `card.animethemesAudioUrl`.
- **Running automatically** (on boot, on import, in the background). Explicit
  Settings action only, matching the cover-art backfill.
- **Storing `malId` on `Anime`.** It would make a second run cheaper (see Notes),
  but it is a migration this feature does not need.
- **Evicting stream-cache entries for the replaced URLs.** They become orphaned
  and age out through feature 41's existing LRU eviction.
- Any change to `/cards`, `/study`, Preview, or the add-candidate groups.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Candidate selection and count** - new
  `server/utils/cardSourceRefresh.ts` with `isAnimethemesUrl(url)` (https, host
  `animethemes.moe` or a subdomain of it) and
  `listSourceRefreshCandidates(): SourceRefreshCandidate[]`, joining `card ->
  song -> anime` and narrowing in SQL with `like(..., "%animethemes.moe%")`
  before the exact host check in JS. `countCardsToRefresh()` returns that list's
  length, so the number shown and the set repaired can never disagree (the
  `countAnimeMissingCover` precedent). Wire the count into
  `GET /api/media-library` as `animethemesSourcedCardCount` and into the settings
  page's `useFetch` type. No provider calls, no UI yet. *Done when:* `bun run
  test` passes with tests covering a remote-only animethemes video (candidate,
  `swapVideo: true`), the same card once `localVideoPath` is set (not a
  candidate for that kind), a URL already on `naedist.animemusicquiz.com` (never
  a candidate), a card whose only animethemes URL is audio (`swapAudio` only), a
  card with no remote URLs at all, and the count equalling the list length;
  `bun run build` passes and `/api/media-library` returns the new field.

- [x] **Step 2 - The pairing rule** - a pure
  `matchTheme(candidate, themes: AnisongTheme[]): AnisongTheme | null` in the
  same file. Compare `titleKey(candidate.songTitle)` against
  `titleKey(theme.songTitle)`. Exactly one match wins. Several matches fall back
  to the one whose `themeSlot` equals the stored slot, and return null if that
  is still ambiguous or matches none. No match returns null. Never pair by slot
  alone: 60a measured 7 of 29 slots disagreeing across providers, 2 of them
  genuinely different songs. Not called by anything yet. *Done when:* `bun run
  test` passes with tests for the unique match, an accent/punctuation/case
  difference still matching ("Deja Vu" against "Déjà Vu"), a real romanization
  difference deliberately not matching, two same-title themes resolved by slot,
  two same-title themes with neither slot matching returning null, and an empty
  theme list returning null.

- [x] **Step 3 - The run loop** - `refreshCardSources(deps, report)` in the same
  file, where `deps` is `{ fetchAnime, fetchThemes }` injected so tests never
  stub global fetch (the `backfillMissingCovers` precedent). Group candidates by
  `animeId`; for each anime, sequentially: `fetchAnime(aniListId)` for its
  `malId`, then `fetchThemes(malId, aniListId)`, then `matchTheme` per candidate
  card and one `db.update(card)` per card that gains at least one URL. Write a
  kind only when the candidate flagged it **and** the matched theme has a URL for
  it; never null a column, never touch a kind the candidate did not flag. Report
  `{ label, completed, total, skipped, unavailable }` per anime so
  `ActivityStatus` renders "Processed N of M anime". Failure rules: an anime with
  no AniList record, no `malId`, or no matching theme is skipped; a
  `ProviderUnavailableError` from `fetchAnime` counts as unavailable and the loop
  continues; a `ProviderUnavailableError` from `fetchThemes` ends the run by
  rethrowing, because AnisongDB is the entire point of the action and there is
  nothing to fall back to; the run throws `AnimeLookupUnavailableError` at the
  end if nothing was updated and at least one anime was unavailable. *Done when:*
  `bun run test` passes with tests for both kinds swapping on a title match, a
  card with a local audio path keeping its animethemes audio URL, a theme with no
  audio URL leaving the stored audio alone, a no-match card written not at all, a
  missing `malId` skipping the anime, one AniList outage continuing the loop and
  counting `animeUnavailable`, an AnisongDB outage aborting the run, all-anime
  unavailable throwing, and two cards under one anime costing exactly one
  `fetchThemes` call.

- [x] **Step 4 - Route** - `server/api/lookup/source-refresh.post.ts` beside
  `cover-backfill.post.ts`, wrapping `refreshCardSources` in
  `respondWithImportProgress` and injecting the real `fetchAnimeFromAniList` and
  `fetchThemesByMalId`. Goes straight to AniList rather than through
  `createAnimeMetadataResolver`, for the same reason `cover-backfill` does: the
  AnimeThemes and stored-row fallbacks carry no `malId`, so falling back would
  report every anime as skipped and look like a successful no-op. *Done when:*
  `curl -X POST -H 'accept: application/x-ndjson'
  localhost:3000/api/lookup/source-refresh` streams `stage`, `progress` and
  `done` lines; the same call without the header returns the plain JSON result;
  a card that was on `v.animethemes.moe` is on `naedist.animemusicquiz.com` in
  the DB afterwards.

- [x] **Step 5 - Settings control** - `SettingsCardSourceControl.vue`, mirroring
  `SettingsCoverArtControl.vue`: a count line, a button disabled at zero, an
  `ActivityStatus` fed by `useImportProgress`, a summary sentence, the result
  held in `useState` (a plain `ref` is lost when `saved` re-runs the page fetch
  and remounts the panel), and `emit("saved")` on success. Rendered in the Media
  library section under the cover-art control. The summary must name the
  permanence of a skip, as the cover-art one does: a card whose title AnisongDB
  does not match will be skipped again on every future run, so a count that never
  reaches zero is expected, not a stuck job. *Done when:* `/settings` -> Media
  library shows "N cards still stream from animethemes.moe", clicking the button
  shows live per-anime progress, the count drops afterwards, the summary names
  updated and skipped, and the button is disabled with a "Every card already uses
  the faster source." line when the count is zero.

- [x] **Step 6 - Wait out AniList's rate limit** - added after step 5's live
  testing found AniList enforcing **30 requests a minute** (documented as 90),
  which a 107-anime library exhausts in about 8 seconds: roughly 30 anime
  resolved and the remaining 77 all counted `unavailable`, needing four or five
  clicks a minute apart. `ProviderUnavailableError.retryAfterMs` is already
  parsed from the `Retry-After` header and carried, and nothing reads it. In
  `refreshCardSources`, a `ProviderUnavailableError` from `fetchAnime` that
  carries a non-zero `retryAfterMs` now sleeps that long and retries that one
  anime; a zero (a provider simply down) still counts unavailable immediately,
  since waiting would learn nothing. Bounded by a per-run cap on the number of
  waits and a per-wait ceiling, so a provider that keeps asking for more time
  cannot stall the run. The wait re-reports progress every few seconds under a
  "Waiting out AniList's rate limit" label, because `ActivityStatus` calls
  itself stalled after 15 seconds without an event. *Done when:* `bun run test`
  passes with tests for a rate limit being waited out and the anime retried, no
  wait when no `Retry-After` is sent, and the per-run cap bounding the waits;
  a full run against a copy of the real library completes in one click with no
  `unavailable` count.

- [x] **Step 7 - Verification pass** - run the manual path in Testing below end
  to end, plus `bun run test` and `bun run build`. *Done when:* every manual
  check passes and both commands are green.
  **Run against `GAQ_SRS_DATA_DIR` copies of the real library, never the real
  one:** this is a bulk rewrite with no undo, so the first run on the live
  database is the user's own click. Copies covered every manual step. The full
  107-anime run returned `{ checked: 169, updated: 151, skipped: 18,
  animeUnavailable: 2 }` in one click, and the 151 reconciles exactly against
  the database (62 both kinds, 72 audio-only because the card has a local video,
  17 video-only). Manual step 5's "starts noticeably faster" was measured rather
  than eyeballed, as a 256KB range request on card 22 before and after:
  `v.animethemes.moe` TTFB 1.096s / 2.004s total, `naedist.animemusicquiz.com`
  TTFB 0.341s / 0.794s total, both `206`, so range requests and scrubbing still
  work.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/utils/cardSourceRefresh.ts` (new) | Candidates, count, pairing, run loop |
| `nuxt-app/server/utils/cardSourceRefresh.test.ts` (new) | Steps 1-3 coverage |
| `nuxt-app/server/api/lookup/source-refresh.post.ts` (new) | Route, progress stream, real providers |
| `nuxt-app/server/api/media-library.get.ts` | Adds `animethemesSourcedCardCount` |
| `nuxt-app/app/pages/settings.vue` | New field in the fetch type, renders the control |
| `nuxt-app/app/components/settings/SettingsCardSourceControl.vue` (new) | The Settings panel |

Read-only dependencies, none of them changed: `server/lib/anisongdb.ts`
(`fetchThemesByMalId`, `AnisongTheme`), `server/lib/anilist.ts`
(`fetchAnimeFromAniList`), `server/utils/textMatch.ts` (`titleKey`),
`server/utils/importProgress.ts`, `server/utils/animeMetadata.ts`
(`AnimeLookupUnavailableError`), `app/composables/useImportProgress.ts`,
`app/components/ActivityStatus.vue`.

## Data / contracts

No schema migration. `card.animethemesVideoUrl` and `card.animethemesAudioUrl`
already hold a URL from either provider (60a's decision, unchanged); this writes
the same columns.

```ts
// server/utils/cardSourceRefresh.ts
export interface SourceRefreshCandidate {
  cardId: number;
  animeId: number;
  aniListId: number;
  songTitle: string;
  themeSlot: string;
  swapVideo: boolean; // animethemes video URL stored and no local video path
  swapAudio: boolean; // animethemes audio URL stored and no local audio path
}

export interface SourceRefreshResult {
  checked: number;          // candidate cards examined
  updated: number;          // cards that gained at least one AMQ URL
  skipped: number;          // checked - updated
  animeUnavailable: number; // anime skipped because AniList was unreachable
}

export interface SourceRefreshDeps {
  // malId is optional, not just nullable: AnimeMetadata omits it entirely on
  // the fallback paths, so the narrowest shape both callers satisfy is this.
  fetchAnime: (aniListId: number) => Promise<{ malId?: number | null } | null>;
  fetchThemes: (malId: number, aniListId: number) => Promise<AnisongTheme[]>;
}
```

`GET /api/media-library` gains one field, `animethemesSourcedCardCount: number`.
The settings page's hand-maintained copy of that response type must be updated in
the same order as the server declaration (F-09's duplication rule).

`POST /api/lookup/source-refresh` returns `SourceRefreshResult`, either as one
JSON body or as the `done` event of an NDJSON stream, exactly as
`/api/lookup/artist-import` does.

The run is **idempotent and resumable**: an updated card stops being a candidate,
so a second run only re-examines what is left. It is not transactional - a run
that dies mid-way keeps the swaps it already wrote, which is the desired
behavior, not a gap.

## Testing

Vitest is configured (`bun run test` from `nuxt-app/`), so the logic-test gate is
on. Every step here except 4 and 5 is pure server logic and ships its own tests.

| Step | Logic needing a test |
|---|---|
| 1 | Host check, per-kind candidate rule, local-path exclusion, count-equals-list |
| 2 | Unique title match, accent/case normalization, real romanization difference not matching, same-title slot tie-break, ambiguous returning null |
| 3 | Both kinds swapped, local path respected, missing kind on the theme, no-match writing nothing, missing `malId`, AniList outage continuing, AnisongDB outage aborting, all-unavailable throwing, one `fetchThemes` per anime |
| 4 | None (route wiring); covered by the manual path |
| 5 | None (UI); covered by the manual path |

Use the in-memory SQLite mock of `../db/client.ts` that `coverBackfill.test.ts`
already sets up, and build fixtures through `upsertAnime`/`upsertSong`/
`createCard` rather than raw inserts. Inject `fetchAnime`/`fetchThemes` as fakes;
never call either live API from a test.

Manual path, with `bun run dev` in `nuxt-app/`:

1. Confirm you have at least one card added before 60a - one whose Preview shows
   a `v.animethemes.moe` URL and which has no local file. If not, temporarily
   set a card's URLs back to animethemes.moe by hand in the DB.
2. `/settings` -> Media library. The new panel should read "N cards still stream
   from animethemes.moe", with N matching those cards.
3. Click the button. Progress should count anime, not hang silently.
4. The summary should name how many were updated and how many were skipped, and
   the count line should have dropped by the updated number.
5. Open one updated card's Preview from `/cards`. It should play, and start
   noticeably faster than before.
6. Click the button again. Only the skipped cards should be re-checked, and
   nothing already on AMQ should be touched.
7. With the count at zero (or all remaining cards unmatched), the button is
   disabled and the panel says every card already uses the faster source.
8. Simulate AnisongDB being down (block `anisongdb.com` in `/etc/hosts`). The run
   should stop with a visible error rather than reporting a successful no-op, and
   no card's URL should have changed to anything broken.

Final gate: `bun run test` and `bun run build` from `nuxt-app/`. No `Verify`
command is declared in `AGENTS.md`, so those two are the automated gate.

## Notes for the AI

- Provider calls are server-only, reached through `server/api/`, per
  `coding-standards.md`. Nothing client-side talks to AnisongDB or AniList.
- **Pair on title, never on slot.** This is 60a's load-bearing lesson: the two
  providers number slots differently (Ave Mujica's ED1 on AnimeThemes is
  AnisongDB's Ending 2), and a slot pairing would leave a card titled one song
  and playing another. A real romanization difference that fails to match is the
  correct outcome, not a bug to work around with fuzzier matching.
- Reuse `titleKey` from `server/utils/textMatch.ts`. Do not write a second
  normalizer.
- Reuse `fetchThemesByMalId` as it stands. It already filters dubs and insert
  songs, guards both linked ids, and picks the richest media per slot.
- Sequential across anime, on purpose: AniList rate limits and this can run over
  an entire library. The `backfillMissingCovers` loop is the precedent.
  **Measured 2026-09-13 during step 5:** AniList is enforcing **30 requests a
  minute**, not its documented 90 (`x-ratelimit-limit: 30` alongside a `429`),
  and the loop runs about 4 anime a second, so a 107-anime library exhausted the
  budget in roughly 8 seconds. Step 6 added the wait-and-retry that this note
  originally said was absent; a run now costs about a minute per 30 anime and
  still finishes in one click. The idempotence above remains the safety net if a
  run is interrupted.
- One AnisongDB call per anime, not per card. `mal_ids_request` does accept an
  array of MAL ids, so several anime could batch into one call, but the AniList
  hop that supplies each `malId` cannot batch and dominates the cost. Not worth
  new client surface here.
- `AnimeMetadata.malId` is optional because the AnimeThemes and stored-row
  fallbacks do not carry one. That is exactly why step 4 calls
  `fetchAnimeFromAniList` directly.
- Never write `null` into either URL column. The "at least one source" invariant
  (feature 4) must hold without this code having to check it.
- Do not touch `song.title`, `song.titleNative`, `song.animethemesThemeId`, or
  `anime.animethemesId`. A card's identity is not being re-resolved, only its
  clip host.
- A deck bundle exported before this ran still carries animethemes.moe URLs, and
  re-importing it re-introduces them. That is correct (the bundle records what
  the card held) and the action can simply be run again.
- No em dashes in code comments or commit messages, per the Writing section of
  `coding-standards.md`.
