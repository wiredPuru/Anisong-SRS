# Feature: Difficulty for outside-library endless songs

**From build-plan:** feature 112
**Status:** verified (tests, build and live AnisongDB band checks; the host panel was not viewed in a browser)

## Goal

Party's endless queue can already draw random songs from AnisongDB's whole
catalog ("Songs outside my cards and decks"), but it ignores the Difficulty
choice and returns anything. Make Easy / Medium / Hard / Random apply to those
songs, using AnisongDB's own per-song `songDifficulty` (AMQ's guess rate, so
higher is easier), so the host can run an endless playlist of a chosen
difficulty without owning or downloading any of the songs.

## In scope

- A pure mapping from the endless difficulty to an AnisongDB difficulty range:
  Easy 50-100, Medium 30-50, Hard 0-30, Random no range. Boundary values may
  fall in two bands; that is harmless for a random draw.
- `fetchRandomSongs` takes the difficulty and sends the range in the
  `get_n_random_songs` request's `filters.difficulty`
  (`{ start, end, include_no_difficulty: false }`). Random sends no difficulty
  filter at all, so songs with no value are drawn only under Random.
- `topUpCatalog` passes `state.endless.difficulty`, and drops a response that
  arrives after the host has changed difficulty, source, or stopped endless
  (today it only checks `outsideLibrary`).
- The endless panel shows the Difficulty pills and a band hint while
  "Songs outside my cards and decks" is on, and its copy stops saying difficulty
  does not apply. Labels stay Easy / Medium / Hard / Random.

## Out of scope

- In-library endless: it keeps its AniList-popularity bands unchanged.
- Study filters and the downloaded-only option for outside songs (still not
  applicable; their existing "don't apply" copy stays).
- A local catalog or any new table or migration (the "full local catalog"
  option was declined; this stays live and online only).
- Showing a song's numeric difficulty anywhere, and tuning the band edges.
- Songs already in the queue when difficulty changes: they stay, only later
  top-ups follow the new difficulty.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Difficulty range and request body** - add a pure
  `catalogDifficultyRange(difficulty)` to `server/utils/partyEndless.ts`
  (`{ start, end } | null`), and a pure `randomSongsPayload(count, range)` in
  `server/lib/anisongdb.ts` that builds the request body. `fetchRandomSongs`
  gains an optional difficulty argument and uses them. Tests for both. *Done
  when:* `bun run test` passes with cases for all four difficulties, and
  `fetchRandomSongs(n)` with no difficulty sends exactly today's body.
- [x] **Step 2 - Wire the endless top-up** - `topUpCatalog` passes the config's
  difficulty, and after the fetch discards the batch unless endless is still on,
  still outside-library, and still the same difficulty. Check the
  upcoming-song swap path (`partyStore.ts`, near "Swaps an upcoming song") for
  an outside-library branch and give it the same difficulty if it draws from
  the catalog. *Done when:* with endless on and Easy chosen, a live game's
  queue fills with songs whose AnisongDB difficulty is 50+ (checked by logging
  or a direct request), and switching to Hard mid-game makes later top-ups
  come from 0-30 while already-queued songs stay.
- [x] **Step 3 - Panel UI** - in `PartyEndlessPanel.vue` show the Difficulty
  pills and hint when outside-library is on, with per-band hints (for example
  "Songs most players get right" / "Middling" / "Songs few players get"), and
  rewrite the outside-library note to say filters and downloaded-only don't
  apply but difficulty does. Changing the pill while running sends the
  existing endless command, as it does for library queues. *Done when:* in the
  host panel at `/party/host`, ticking the outside option keeps the pills
  visible, the copy is accurate, and a screenshot confirms the layout.

## Files / areas

- `nuxt-app/server/utils/partyEndless.ts` (and `partyEndless.test.ts`)
- `nuxt-app/server/lib/anisongdb.ts` (and a test file beside it, if none exists)
- `nuxt-app/server/utils/partyStore.ts` (`topUpCatalog`, the swap path)
- `nuxt-app/app/components/party/PartyEndlessPanel.vue`

## Data / contracts

- `PartyEndless` (`partyGame.ts`) already carries `difficulty` and
  `outsideLibrary`; no shape change, no migration, no new route.
- AnisongDB `get_n_random_songs` body: `{ n, filters?: { difficulty?: { start,
  end, include_no_difficulty } } }`. Confirmed live on 2026-10-19: a 60-100
  range returned only songs rated 60 or higher.
- Catalog skew (from `database_stats`, 38.7k songs): about 31% of songs are 30+,
  8% are 50+. Hard is the bulk of the catalog and Easy a small, well-known slice;
  the random draw stays varied because the pool is thousands of songs.

## Testing

- Vitest (configured): `catalogDifficultyRange` for easy, medium, hard, random;
  `randomSongsPayload` with and without a range (random omits `filters`, so
  no-difficulty songs stay eligible).
- The store wiring and panel are integration and UI: verify with the running
  party server (`bun run party`), a real endless game with the outside option
  on, and a screenshot of the panel.
- Offline mode must still block the outside option exactly as it does today.

## Notes for the AI

- Match the existing code: `topUpCatalog` swallows AnisongDB failures silently
  and retries on the next change; keep that.
- Random songs must not be cached (`postJson` with a null TTL); keep it so.
- No em dashes in code, comments, or copy. Comment the why only, e.g. why
  higher `songDifficulty` means easier.
- The endless queue is not in the old overview's feature list before 112; the
  112 entry in `project-overview.md` describes it, so no further doc edit is
  needed beyond marking 112 built at `/complete`.

## Findings

### 112/F-20 [P2] closed - `fetchNext()` has no stale-response guard, so an older `/api/study/next` answer can overwrite a newer one

**File:** nuxt-app/app/composables/useStudySession.ts:75
**Found:** 2026-09-26 by /audit (scope: full; lens: quality)
**Why it matters:** `fetchNext()` is triggered by the scope watcher, the filters watcher, `studyNewCards()`, and the page's post-review refresh, and nothing orders their responses: whichever request resolves last writes `currentCard`, `criterion`, `dueCount`, and `sessionComplete`. Applying filters while a post-review fetch is in flight, or switching decks while the previous deck's card is still loading, can leave a card on screen that is outside the active scope or filters, with a matching but stale `dueCount`. The review itself stays self-consistent, because `criterion` comes from the same response as the card, so it grades the right track for the wrong card. The codebase already has `createLatestRequest()` (`app/utils/latestRequest.ts`) for exactly this, and eleven other components and composables use it. Not reproduced at runtime; SQLite answers fast, so the race window is widest with a large list filter (up to 5000 ids).
**Suggested fix:** Hold one `createLatestRequest()` in the composable, call `start()` at the top of `fetchNext()`, and drop the result (without clearing `loading`) when `isLatest()` is false. A scope change can also `invalidate()` before it resets state.
**Resolution:** Closed 2026-10-17 by /audit (scope: full, partial; lens: all). `useStudySession.ts:96` now holds `createLatestRequest()`; `fetchNext()` calls `start()` and returns early on `!isCurrent()` in both the success and error paths, so a stale response no longer writes the card, criterion or counts. No new defect in the repaired code.
