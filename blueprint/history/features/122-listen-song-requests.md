# Feature: Listen song requests

**From build-plan:** feature 122
**Status:** verified
**Approved intake:** library and online catalog search, Play now / Play next,
then resume the existing deck. Plan addition approved 2026-11-02.

## Goal

Find a song without leaving Listen, play it immediately or queue it ahead of
the remaining deck, then continue the same deck in its existing order.
Online catalog songs can be temporary requests without becoming library cards.

## Design reference

This extends the existing Listen screen, rather than recreating a new design.
Use `docs/screenshots/listen.png` and `docs/screenshots/listen-mix.png` for
orientation, the live `app/pages/listen/index.vue` for the current arrangement,
and `app/assets/css/main.css` for the current theme's tokens (paths under `nuxt-app/`
unless otherwise stated). Reuse existing modal, button, result-row, and
scroll-area conventions. There is no `prototypes/` directory or new theme to
port. The Party search component is a behavioral reference only; do not copy
its server-owned game state or call its host routes.

## In scope

- A Search songs entry point on `/listen`, available during playback and from
  empty and finished playlist states. Searching keeps the current song playing.
- Two labeled result groups: My library (all library cards, not just the
  selected deck) and Online catalog. Search by song title; library matches may
  also match artist and anime through the existing card search. Show song,
  artist, anime, and theme slot so different versions can be distinguished.
- Play now and Play next on individual playable results. Requested tracks
  temporarily take priority over the remaining deck, without changing deck
  membership, base playlist order, shuffle, filters, or review state.
- A pending-request list, request count, per-request Remove, and Clear requests.
  The list shows requested songs only, not the base deck's unrevealed answers.
- Existing playback/display behavior: Autoplay, play length, Random start,
  Hide Info/Video/Cover, Auto Reveal, audio-only mode, Mix, and dissolve.
- Read-only catalog playback through the existing media stream/cache path,
  honoring Clip source, Offline mode, and Include insert songs.

## Out of scope

- Saved queues, playlists, queue export, drag reordering, bulk requests, or
  automatic imports/downloads of catalog requests into the library.
- New provider integrations, anime/artist catalog browsing, fuzzy catalog
  search modes, catalog metadata enrichment, or replacing the Cards search.
- Resuming an interrupted song at its old timestamp. Play now skips the
  current presentation; returning to the deck starts its next song.
- Study, Party game state, scoring, scheduling, migrations, and rebranding.

## Build loop

Build one step at a time, never the whole feature at once.

1. Describe the next step before editing code.
2. Implement only that step and verify its observable done-when.
3. Show its diff, summarize the behavior, and wait for review before continuing.
4. Offer a checkpoint only after the required checks pass; commit only with
   permission. `/complete` handles the final archive and feature commit.

This spec is one feature with seven reviewable steps. New persisted queue
storage and a general media-player rewrite are not prerequisites.

## Build steps

- [x] **Step 1 - Track identity and read-only media support.** Define the
  library/catalog track union and pure projection into the minimal media and
  display fields. Narrow Listen playback's dependency on `CardWithDetails`
  to the fields it actually uses. Add an explicit read-only capability to the
  shared player for catalog media, with guards at both controls and action
  entry points. Add adjacent tests for mapping, identities, missing metadata,
  allowed sources, and whether a track has a real library-card target.
  *Done when:* existing Study, Preview, and Listen still use real library
  cards normally; a temporary track can supply video/audio and display data
  without fabricated scheduling fields or an eligible card-write target.

- [x] **Step 2 - Temporary request ordering.** Implement pure queue
  transitions over entries with distinct occurrence IDs: Play next, Play now,
  Next/Previous, Remove, Clear requests, and reset. Add tests in the same diff.
  *Done when:* for deck A/B/C, requesting X then Y during A gives A/X/Y/B/C;
  playing Z now during A gives Z followed by pending requests and B/C;
  the original deck entries retain their relative order in every case.
  Removing a request for B never removes B's original deck entry.

- [x] **Step 3 - Session integration and deck continuation.** Integrate the
  transitions into `useListenSession`, exposing current/next entries,
  pending requests, entry-aware navigation, and base-deck progress. Keep
  prefetch and library-card patches pointed at the correct entries. Reset
  request state on a new scope, filters, shuffle, restart, or page visit, and
  reject stale asynchronous work from a replaced queue. Test the session
  logic without mounting UI components.
  *Done when:* the existing Listen controls still traverse the deck; invoking
  session request actions plays requests and then the exact remaining deck
  suffix, including at its end and with an empty base deck. Requests do not
  inflate the base-deck total or write review state. A late ended/play-limit
  event from a retired presentation cannot advance its replacement.

- [x] **Step 4 - Mix follows queue edits.** Make the playback coordinator
  identify both current and upcoming occurrences, replace an obsolete standby
  when the next entry changes, and cancel its unfinished preparation/handoff.
  Preserve the current player's position for future-only edits. Play now
  retires the old presentation and any tail immediately. Add coordinator
  tests using the existing fake player ports.
  *Done when:* queuing, removing, or clearing requests while B is already
  prepared changes the next handoff to the correct entry without restarting A,
  advancing twice, or leaving an obsolete player audible. Consecutive
  presentations of the same library song remain separate occurrences.

- [x] **Step 5 - Library and catalog search.** Add a Listen search
  composable using the existing card-list and song-search endpoints, with
  independent loading/errors, debouncing, latest-query protection, local
  pagination, and Offline notices. Use pure adapters from Step 1 and test
  query/result handling, stale responses, and partial provider failures.
  *Done when:* a query can return both result groups; one group's failure
  does not discard the other; offline library search remains usable and sends
  no online catalog request. Nothing calls a card import or Party host route.

- [x] **Step 6 - Search and request playback UI.** Add the Search songs
  panel and connect Play now / Play next to the session. Reuse the existing
  player/info surfaces for catalog metadata, show an Online catalog source
  label, and expose only applicable actions. Keep controls reachable on
  empty/finished states and preserve playback while opening or using search.
  *Done when:* both library and outside-library songs can be requested in
  the running app; Play now starts the chosen track even with Autoplay off;
  Play next leaves the current track playing. Catalog playback cannot open
  a card editor, download against a fake card, or create library records.
  Search stays open with its query and focus intact after a request, with
  inline Playing/Queued feedback, so several songs can be chosen in one visit.

- [x] **Step 7 - Pending requests and complete interaction pass.** Add the
  pending list, count, Remove, and Clear requests. Show request playback
  distinctly from base-deck progress. Finish focus, keyboard, error/empty,
  narrow-window, and current-theme behavior, then verify the full flow with Mix on
  and off, including offline library playback.
  *Done when:* removing/clearing upcoming requests immediately updates what
  plays next, an empty request queue returns to the original deck, and the
  browser scenarios below pass without lost deck position, unintended
  playback shortcuts, or catalog card writes.

## Files / areas

- `nuxt-app/app/utils/listenRequests.ts` and adjacent tests: proposed home
  for track contracts, adapters, occurrence identities, and pure transitions.
- `nuxt-app/app/composables/useListenSession.ts` and adjacent tests: queue
  lifecycle, request actions, navigation, deck progress, prefetch, and patches.
- `nuxt-app/app/composables/useListenPlayback.ts` and its existing tests:
  narrower media inputs and standby invalidation on upcoming-entry changes.
- `nuxt-app/app/components/listen/ListenMediaPlayer.vue`: pass per-slot
  identity and read-only capability into the shared media player.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue`: a backward-compatible
  read-only path; never disable downloads or editing for ordinary library use.
- `nuxt-app/app/composables/useListenSongSearch.ts` and adjacent tests:
  proposed search orchestration, not card importing.
- `nuxt-app/app/components/listen/ListenSongSearch.vue` and
  `ListenRequestQueue.vue`: proposed focused UI components.
- `nuxt-app/app/pages/listen/index.vue`: entry point, request controls,
  current presentation metadata, card-action guards, progress, and hotkeys.
- Existing `GET /api/cards`, `GET /api/lookup/song-search`, server
  `utils/songSource.ts`, and media endpoints are reused. No new route or
  schema is required by this spec.

## Data / contracts

**Load-bearing: song identity, queue occurrence, and library-card identity
are separate.** Keep these client-side types near the Listen utilities;
mirror an existing server response rather than importing server modules into
the client or creating a shared `app/types/` tree.

```ts
type ListenTrack =
  | { kind: "library"; key: string; card: CardWithDetails }
  | { kind: "catalog"; key: string; song: ListenCatalogSong };

interface ListenQueueEntry {
  entryId: number;
  origin: "deck" | "request";
  track: ListenTrack;
}
```

- Library keys use `card:<id>`. Catalog keys use provider `resultKey`, AniList
  anime ID, and theme slot, so equal titles or one recording used in several
  shows are not conflated. `entryId` is unique within the session and stays
  distinct for a request and that song's original deck occurrence.
- `ListenCatalogSong` mirrors the existing song-search result:
  `resultKey: string`, `animethemesThemeId: number | null`,
  `themeSlot: string`, `songTitle: string | null`,
  `songTitleNative: string | null`, `artistName: string | null`,
  `animeAniListId: number`, `animeAnimethemesId: number | null`,
  `animeTitleRomaji: string`, `videoUrl: string | null`,
  `audioUrl: string | null`, and `clipBlocked: boolean`.
- The media projection contains only the existing shared player's media
  fields: `id`, local video/audio paths, remote video/audio URLs, theme slot,
  and cover URL. Catalog entries use a reserved negative occurrence ID only
  as a player identity; their real `libraryCardId` is explicitly `null`.
  Do not cast a catalog result into a fabricated `CardWithDetails`.
- The shared player's read-only path suppresses manual/background downloads,
  download-before-autoplay, stale-path card PATCHes, and card-dependent
  last-played persistence. Explicitly guard handlers as well as hiding UI.
  Stream-cache use remains allowed. Keep this capability per playback slot,
  including the standby and outgoing tail, rather than borrowing the current
  foreground track's capability.
- Library tracks retain their real card fields and existing explicit edit,
  download, and Japanese-breakdown actions. Patch every occurrence of a
  matching library card after an explicit edit/download. Catalog entries have
  no edit/deck/status actions or source-card foreign key; omit those targets.
- Use available catalog titles/artist/slot and normal missing-cover fallback.
  Missing native titles and anime metadata remain absent; do not fetch extra
  providers to fill them. Only build links from real known IDs or existing
  search-link helpers; never link to a fabricated artist/anime deck.
- Local search reuses `GET /api/cards?q=<text>&page=<n>` returning
  `{ cards, page, totalPages, total }`. Do not use `/api/search`, which only
  returns five song-title matches. Catalog search reuses
  `GET /api/lookup/song-search?q=<text>` returning `{ results }`; it already
  handles provider fallback, Include insert songs, and Clip source filtering.
- Search starts after two trimmed characters, debounced 250 ms. A shorter
  query clears results and invalidates pending responses. No catalog search
  runs until the network mode is known to be online. Show the existing
  Offline notice and Settings link when offline; errors stay within their
  result group, with Retry. Disable requests for blocked/no-source results
  with a reason. Playback-time failures retain Retry and Next song.
- Keep library and catalog groups independent. The same song may appear in
  both; their source labels distinguish them. Do not add a cross-provider
  title-based identity matcher or metadata import just to collapse these rows.
  An online result is a temporary request even if a library card also exists;
  selecting the library result uses the real card and its local media.

**Playback rules**

| Action / situation | Required behavior |
| --- | --- |
| Play next | Keep the current presentation playing. Append after existing pending requests, ahead of the remaining deck. Requests are FIFO. |
| Play now | Interrupt the current presentation and start the selected track. Keep other pending requests, then resume at the next deck entry. |
| Repeated request | Play next adds no new occurrence when that track key is already upcoming; report Queued. Play now moves the first matching pending request into playback instead of adding another. |
| Play now on current track | Restart that presentation, following the existing Random start setting, without adding another pending copy. |
| A request is also in the deck | Its original deck occurrence remains in place and can play later. No title-only deduplication. |
| Next / Previous | Traverse the playback order including request entries, without manufacturing another request or losing the base deck's order. |
| Remove / Clear requests | Remove only request occurrences after the current cursor, never the current song, entries before it, or base-deck entries. |
| Empty or finished deck | Either request action starts the selected song immediately. Once normal advancement exhausts the requests, show the normal empty/finished state. |
| Autoplay off | An explicit Play now starts its song; subsequent advancement still waits for Next. Play next does not start over the current song. |
| Clip failure | Keep the request's error visible with Retry / Next song. Skipping it continues requests or the deck without resetting the session. |
| Scope/filter/shuffle/restart/page reset | Start a fresh base playlist and clear temporary requests/history. Ignore work from the old queue. |

`presentationKey` changes whenever a song is shown or restarted, even for
the same track. `queueKey` identifies a replacement session; changing future
requests must not masquerade as a full playlist reset. Feed the effective
next occurrence to prefetch and Mix. Once a Mix handoff has committed, its
incoming song is current; a subsequent request acts relative to that song.
Retired players and old play-length timers must carry/check their original
presentation identity before advancing; reading only the new current key at
callback time cannot distinguish a late event. A queue edit from a stale
search selection must also check the session epoch before applying.

Next/Previous walk the combined playback order. Pending means after the
current cursor, even after using Previous; entries before it are history.
Adding a request prioritizes the upcoming request entries ahead of the deck
suffix, preserving each group's relative order. Navigation itself does not
reorder or duplicate entries. Replaying earlier entries does not manufacture
new occurrences; their original occurrence IDs are retained.

Deck progress counts original deck entries only. While a request is current,
identify it as a requested song and retain the deck progress/return context.
Selecting a song bypasses the base deck's scope and filters intentionally;
provider, clip-source, and network restrictions still apply.

## Testing

- Vitest is configured. Each logic-bearing step includes adjacent tests in
  the same diff: source mapping/read-only eligibility, FIFO and interruption,
  duplicate keys versus distinct occurrences, navigation/removal/reset,
  stale search/session results, and changed-next Mix preparation/handoff.
- Include boundary cases: one-card/empty/finished decks; request for the next
  deck song; repeated Play now; removing the only request; Previous across a
  request and back forward; request insertion during a pending or committed
  Mix handoff; same song on consecutive presentations; missing/blocked media;
  a failed catalog search alongside successful library results; late end or
  timer callbacks after Play now; and Play next while browsing history.
- Run `bun run test` and `bun run build` from `nuxt-app/` as the documented
  automated gates. There is no declared Verify command. Planning this feature
  does not require running the app build or changing tests.
- UI and integration evidence comes from the running app, screenshots, and
  network observations, rather than component unit tests. Reuse installed
  browser tooling; do not install a browser runner as part of this feature.
- Browser walkthrough: play a known deck A/B/C, request a library song and an
  outside-library catalog song, remove/re-add one, and observe A/requests/B/C.
  Repeat with Play now during A, then confirm B is next after the requests.
  With Autoplay off, Play now starts its track and completion waits for Next.
- Repeat request insertion and removal while Mix has prepared the next song,
  then during a dissolve. Observe correct audio/video, no stale standby, no
  doubled advance, and no foreground restart from a future-only queue edit.
- Cover empty/finished playlists, no matches, provider error, offline local
  and complete-cache playback, a failing clip, light/dark system color preferences, and a narrow
  window. Closing search restores focus to its trigger; typing and activating
  search/queue controls must not trigger the page/player's playback hotkeys.
- With Auto Download enabled, play a catalog result and inspect requests plus
  library/deck counts and review state: no import, card creation/PATCH,
  card-download, or review call is made for that catalog request. Then play
  a library card and confirm its existing download/edit behavior still works.

## Notes for the AI

- Keep server-only provider access on existing server routes. Do not reach
  into `partyStore`, require the Party launcher, or introduce catalog state
  shared between browser sessions.
- Use the current app theme, scoped CSS variables, accessible buttons,
  independent loading/error states, and scrollable result regions. The
  two-action result rows must not treat an arbitrary row click as Play now.
- The search panel must not hold or pause playback merely because it is open.
  Keep its keyboard events from reaching both Listen's page shortcuts and the
  shared player's separate window listener; a pause/hold flag is not a
  keyboard-only guard. Restore normal shortcuts when it closes.
- Keep all request state in memory. Existing stream-cache writes and explicit
  user actions on real library cards remain ordinary app behavior; no new
  persisted queue or catalog entity is introduced.
- Before implementation, inspect the current diff and create the normal
  feature branch. Build only the first unchecked step, then show its diff.
  This command stops at spec review and makes no application changes.

**Implementation observation:** the app currently exposes one Midnight theme,
with no Appearance selector. Verify the current tokens under both system color
preferences; the older Kai theme screenshots are layout references only.

## Verification evidence

- Final automated gates, run from `nuxt-app/`: `bun run test` passed
  (209 files, 2,767 tests, including 40 new tests); `bun run build` passed.
  `git diff --check` passed. No declared Verify command exists.
- Real browser/provider flow: library search for Taiyou and outside-library
  catalog search for Hacking to the Gate; Play next preserved the foreground,
  Play now streamed the catalog song, and Next returned to deck position 2.
  Catalog playback with Auto Download enabled made zero card writes and
  exposed no card editor. Library Play now worked with Autoplay off; Space
  on Play next did not pause the player, Escape closed search, and focus
  returned to its trigger. Then Next waited for explicit playback.
- Isolated browser fixtures, using local MP4s and intercepted API responses
  rather than database writes: A/X/Y/B/C ordering; request removal/clearing;
  Previous/Next; empty/finished decks; offline local playback; catalog error
  isolation and Retry; no matches; 390px layout; light/dark system preferences;
  prepared-next replacement; Mix/dissolve and pause; queue edits during an
  overlap; immediate interruption; failed-media Retry. Zero runtime errors or
  attempted card writes occurred. Expected fixture HTTP failures exercised
  error states; they were not unhandled application errors.
- Screenshots and review packet: `/tmp/gaq-122-evidence/`. Final build/test
  logs: `/tmp/gaq-122-final-build.log`, `/tmp/gaq-122-final-tests.log`.
- Self-review fixes: corrected the result-row formatter import; restored
  keyboard focus after a queued button becomes disabled; kept Escape working
  from that state; removed an unnecessary player-only prop from display
  controls; wrapped header controls for narrow windows; clarified the current
  Midnight theme reference. No remaining feature defect was identified.
- Regular check, audit, and try-guide policies are all `manual`; their named
  skills did not run automatically. The browser evidence above is build-step
  verification. No P0/P1 finding is open or fixed in the current ledger.
- Autopilot leaves feature 122 unchecked in the build plan and this verified
  spec active for review. Next action: review the branch diff, then `/complete`.

## Completion safety pass

Logged 2026-11-02 on `feature/listen-song-requests`; squash merge is pending
explicit approval.

- `/complete` reran `bun run test` (209 files, 2,767 passing tests) and
  `bun run build` successfully from `nuxt-app/`.
- `git diff --check` passed; all seven implementation steps are checked.
- Existing browser screenshots, console/network observations, and manual try
  path from this feature were reused. No application changes followed them.
- Regular check, audit, and try-guide gates are manual. No open or fixed P0/P1
  finding blocks completion. All 16 unresolved P2/P3 ledger entries remain
  verbatim; no resolved findings needed archival.
- Feature 122 is checked in the build plan and the active spec is reset to the
  canonical stub. The generated overview reflects the completed feature.
- Completion logs: `/tmp/gaq-122-complete-tests.log` and
  `/tmp/gaq-122-complete-build.log`. Browser review packet and screenshots:
  `/tmp/gaq-122-evidence/verification.md`.

How to try: open `/listen`, choose Search songs, then Play now or Play next.
Use Queue to remove or clear requests; Next returns to the existing deck.
Run `/try latest` for a longer walkthrough.
