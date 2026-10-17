# Feature: Offline play

**From build-plan:** feature 107d (Offline-first library)
**Type:** Feature
**Status:** verified

## Goal

With Offline mode (107b) on, Study, Listen and Party only promise what can
actually play. A clip that is not downloaded says so instead of failing, an
opt-in "Playable offline only" choice leaves cards with no usable local file or
complete cached clip out of Study and Listen (with a count), and typed-answer
suggestions come from the local library. Grading is unchanged.

## Decisions (made at intake, recommended defaults)

- **Setting lives in the database**, like `themesOnly`: `MediaLibrarySettings.playableOfflineOnly`
  (default false). Study, Listen and Party read it server-side, so the next card,
  "N left", prefetch lookahead, Practice and the Listen/Party queues always agree.
  It is only *effective* while Offline mode is on; online it is ignored (and its
  control is hidden), so it can never strand a library when the user goes back online.
- **"Playable" = the card has a local video/audio path whose file exists inside a
  library folder, or a remote clip URL (allowed by Clip source) whose complete copy
  is in the stream cache.** Cache files are renamed into place only once fully
  fetched, so presence means complete.
- **The count is library-wide**: "N cards hidden: not downloaded", not per-scope.
- **Typed-answer suggestions offline** come from a new local route over the
  library's own anime, artists and songs, in the same redacted shapes.
- Out of scope: downloading from here, changing the 409 contract, any change to
  grading, scheduling, or what Offline mode refuses (107b).

## In scope

- Setting, migration, route, and a Settings toggle shown only while offline.
- `playableOfflineCardIds()` server util (memoized a few seconds) and its use in
  Study's due/practice conditions, Listen's queue, and Party's queue load.
- `GET /api/media/cached?url=` and a player message for an uncached remote clip
  while offline.
- `GET /api/study/answer-local?kind=anime|artist|song&q=` and the three answer
  search composables using it while offline.
- Hidden-count notes in Study, Listen and the Party host panel.

## Build steps

- [x] **Step 1 - Setting and playable set (server).** Migration `0038`, column
  `playableOfflineOnly`, `getPlayableOfflineOnly`/`setPlayableOfflineOnly`,
  `POST /api/media-library/playable-offline-only`, exposed on the settings
  payload, and `playableOfflineCardIds()` (+ `offlinePlayableFilterActive()`:
  offline AND setting). Tests for the playable classification with a fake fs and
  cache. *Done when:* tests pass; the route round-trips the flag.
- [x] **Step 2 - Apply to Study (server).** `baseDueCondition`,
  `getPracticeCard`, and the upcoming/count paths exclude non-playable cards via
  `card.id IN (select value from json_each(?))` when the filter is active;
  `/api/study/next` returns `offlineHidden` (library-wide count, 0 when inactive).
  *Done when:* unit test shows non-playable cards leave the due set only while
  active; counts agree with the next card.
- [x] **Step 3 - Apply to Listen and Party (server).** The same filter in the
  Listen queue and Party queue load, each returning the hidden count; Party's
  existing "no clip" drop reports it. *Done when:* tests cover both.
- [x] **Step 4 - Settings toggle (client).** A "Playable offline only" checkbox
  in Settings > Media library, rendered only while Offline mode is on, with a
  one-line explanation. *Done when:* hidden online, saves offline, persists.
- [x] **Step 5 - Uncached clip message (client).** Built without the planned
  `/api/media/cached` route: offline the stream route already serves only a
  complete cached copy, so `StudyMediaPlayer` recognizes a failed stream URL while
  offline (`isOfflineUncachedFailure`, tested) and shows "This clip isn't downloaded and Offline mode is on." with a Settings link
  instead of a failed load. *Done when:* a remote-only uncached card shows the
  message and sends no stream request; a cached or local one plays.
- [x] **Step 6 - Local typed-answer suggestions.** The local answer route and the
  three composables switching to it while offline. *Done when:* unit tests cover
  the route's queries and redaction; offline, typing an anime/artist/song title
  suggests library entries with no `/api/lookup/*` request.
- [x] **Step 7 - Hidden-count notes and proof.** Study, Listen and the Party host
  panel show "N cards hidden: not downloaded" when active. Walk it on an isolated
  server (own port and data dir, never the user's). *Done when:* `bun run test`
  and `bun run build` pass and the evidence is recorded below.

## Notes for the AI

- Verify only against an isolated dev server on a free port with its own
  `GAQ_SRS_DATA_DIR`; check which process owns the port before any POST.
- Keep suggestion shapes redacted exactly as they are online.
- No em dashes in copy, comments or commits.

## Evidence (step 7)

Isolated dev server (own `GAQ_SRS_DATA_DIR`, port 3011, process checked before
use) with two seeded cards: one with a local file in the library folder, one
remote and uncached.

- `/api/study/next`: online with the choice off or on, both cards due and
  `offlineHidden` 0 (the choice is ignored online). Offline with the choice on:
  only the local card, `dueCount` 1, `offlineHidden` 1. Offline with the choice
  off: both again.
- `/api/listen/queue` offline with the choice on: only the local card, `offlineHidden` 1.
- `/api/study/answer-local`: returns library anime, artists and songs in the
  redacted shapes; an uncarded song and show are not suggested. The provider
  route answered 409 offline, as before.
- Browser: offline, the uncached card's player shows "This clip isn't downloaded,
  and Offline mode is on." with an Offline mode link and no download actions.
  The Settings toggle renders offline and not online. Study's header and
  Listen's header note show "1 card hidden: not downloaded" with the choice on.
- `bun run test` (2483 passed) and `bun run build` pass.

**Deviations:** step 5 was built without the planned `/api/media/cached` route
(offline, the stream route already serves only complete cached copies, so a
failed stream URL is the signal).

**Not browser-verified:** the Party host panel's hidden-count note (needs the
`gaq-party` doors and a host login), typing a suggestion in the three answer
boxes, and Listen/Party playback of a cached remote clip. The Party and Listen
queue filters are covered by unit tests and the Listen route call above.
