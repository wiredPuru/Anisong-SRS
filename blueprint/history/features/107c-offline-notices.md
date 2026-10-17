# Feature: Offline notices

**From build-plan:** feature 107c (Offline-first library)
**Type:** Feature
**Status:** verified

## Goal

While Offline mode (107b) is on, every online-only surface says plainly that
it needs online mode, with a way to reach the setting, instead of firing a
request and showing the server's 409 as a red error. Local library use (local
card search, decks, Study, Listen, stats, local downloads from a complete
cached clip) stays exactly as it is.

107b already makes the server refuse every provider call with
`{ code: "OFFLINE_MODE" }`. This feature is presentation only: it adds no
server guard, changes no stored data, and never blocks a request the server
would allow.

Split from the original 107c on 2026-10-17. Offline playback, the "Playable
offline only" choice, library typed-answer suggestions, and the Study/Listen/
Party end-to-end verification are **107d**, not this feature.

## Design reference

No new visual design. Use the existing CSS tokens and the quiet `.version-hint`
/ `.search-status` text styles, not the error styles. One small shared notice
component, reused everywhere. No prototype is consumed.

## In scope

- A shared `isOfflineModeError(err)` helper and a shared `OfflineNotice.vue`
  (neutral text plus an "Open Settings" link to `/settings?section=library`,
  where the Offline mode control lives).
- Surfaces that skip the request and show the notice while
  `useNetworkMode().offlineMode` is `true`:
  - Nav search (`NavSearch.vue`): the Anime and Artists groups. Local card
    results still run.
  - `/cards` add-candidate groups: `CardAddAnimeResults`, `CardAddSongResults`,
    `CardAddArtistResults` (also the artist deck page's catalog section,
    feature 105a), and the AniList/MAL list import (`CardImportListResults` /
    `useCompletedListImport`).
  - `CardBrowseModal`'s "Add from AniList" mode. "Search my library" mode
    (feature 99) keeps working, and the modal opens on it while offline.
  - `DeckAddAnimeModal`'s AniList fallback; `DeckFilterCardsModal`'s "Not in
    your library yet" section (feature 100) and "Import the rest" (feature 94).
  - `StudyFilterForm`'s Anime list section: fetching or refreshing a list is
    online-only, but an already-saved list filter keeps applying.
  - `CardAnimeMetadataRefresh` (107a's explicit refresh).
  - Settings maintenance actions: anime details, AnimeThemes links,
    AnimeThemes match, card re-source, cover-art backfill, and Library
    health's Re-source button. Their buttons are disabled with the notice
    beside them. The update "Check again" button is disabled (the offline
    hint already exists).
  - Party host (`PartyQueueSearch.vue`): the catalog and AniList show groups,
    which today swallow errors into an empty list. The endless panel's
    "Outside your library" option is disabled with a note. The Party notice
    links to the main app (`PartyMainAppLink`), since `/settings` is not
    served on the host door.
- Fallback for a mode that changed after the page loaded: any of these
  surfaces that receives an `OFFLINE_MODE` error shows the same notice
  instead of its red error.
- Downloads keep working offline when the clip is fully cached (107b copies
  it). When a download fails with `OFFLINE_MODE`, the per-card and bulk
  download errors read "Not cached yet - downloading needs online mode."
  instead of the generic 409 text.

## Out of scope

- Anything about playback, the player's error veil, Study/Listen queues, or
  typed-answer suggestions (107d).
- New server guards or changes to the 409 contract (107b owns it).
- Hiding Download buttons offline: a cached clip can still be copied.
- A global offline banner or rail badge beyond what already exists.
- Detecting connectivity; only the persisted Offline mode counts.

## Build loop

One small diff per step, in order. Show the diff, run focused tests plus
`bun run test` and `bun run build` from `nuxt-app/`, and stop for approval
before the next step. Checkpoint commits only with approval; `/complete` owns
the work-level commit and merge.

## Build steps

- [x] **Step 1 - Shared helper, notice, and nav search (client).** Add
  `isOfflineModeError(err: unknown): boolean` to `app/utils/networkMode.ts`
  (true when the H3 error data carries `code: "OFFLINE_MODE"`, including
  `$fetch`'s nested `data.data` shape), with tests. Add
  `app/components/OfflineNotice.vue` (`message` prop or default slot, optional
  `settingsHref`, default `/settings?section=library`, no link when `null`,
  and an `action` slot for a caller's own link). Wire `NavSearch.vue`: while offline, skip the
  Anime and Artists requests and show one notice under the local results;
  an `OFFLINE_MODE` error maps to the same notice. *Done when:* tests pass;
  offline, typing in nav search sends `/api/search` only (no
  `/api/lookup/*` in the network log), local card results render, and one
  neutral notice links to Settings; online behavior is unchanged.
- [x] **Step 2 - /cards discovery and list import (client).** Apply the same
  pattern to `CardAddAnimeResults`, `CardAddSongResults`,
  `CardAddArtistResults`, and the list import. Each group shows one notice
  instead of searching, and the import button opens a notice instead of the
  username form. *Done when:* offline, a `/cards` search shows local matches
  plus the notices with no `/api/lookup/*` requests; the artist deck page's
  "Other songs by" section shows the notice; online is unchanged.
- [x] **Step 3 - Browse, deck modals, and the list filter (client).**
  `CardBrowseModal` opens in library mode offline, with the AniList mode
  showing the notice. `DeckAddAnimeModal`'s AniList fallback,
  `DeckFilterCardsModal`'s AniList section and "Import the rest", and
  `StudyFilterForm`'s list fetch/refresh show the notice; a saved list filter
  still applies. *Done when:* offline, each modal opens without a red error
  and sends no `anilist-browse`, `anilist-options`, `list-anime`, or
  `import-cards` request; "Search my library" lists and applies results; a
  Study session with a saved list filter still serves matching cards.
- [x] **Step 4 - Settings maintenance actions (client).** Disable the listed
  Settings actions and Library health's Re-source with the notice beside
  them, and disable update "Check again". *Done when:* offline, no
  maintenance button can be clicked, each shows the notice, and none sends a
  request; online is unchanged.
- [x] **Step 5 - Metadata refresh and download errors (client).** Show the
  notice in `CardAnimeMetadataRefresh`. In `useCardDownloads` (and the bulk
  download loops that read its errors), map `OFFLINE_MODE` to "Not cached
  yet - downloading needs online mode." *Done when:* a unit test covers the
  mapping; offline, an uncached download shows that text and a fully cached
  clip still downloads; online is unchanged.
- [x] **Step 6 - Party host (client).** `PartyQueueSearch` shows the notice
  in place of the catalog and AniList show groups while offline, with
  `:settings-href="null"` and a `PartyMainAppLink` to `/settings?section=library`
  in its `action` slot; library groups still
  search. The endless panel disables "Outside your library" with a note. *Done
  when:* offline, a host-panel search returns library songs and decks, shows
  one notice, and sends no `catalog-search` or `anime-search` request.
- [x] **Step 7 - Prove it.** With a disposable data directory in Offline
  mode and a clean browser profile, walk every surface above and capture the
  network log and screenshots. Turn Offline mode off and confirm each surface
  searches again after the page reloads. *Done when:* no surface shows a red
  offline error, no `/api/lookup/*` or Party catalog request is sent offline,
  local search, decks, Study start, and cached downloads still work, and
  `bun run test` plus `bun run build` pass.

## Files / areas

- `app/utils/networkMode.ts` (+ test), new `app/components/OfflineNotice.vue`.
- `app/components/nav/NavSearch.vue`.
- `app/components/card/CardAddAnimeResults.vue`, `CardAddSongResults.vue`,
  `CardAddArtistResults.vue`, `CardImportListResults.vue`,
  `CardBrowseModal.vue`, `CardAnimeMetadataRefresh.vue`;
  `app/composables/useCompletedListImport.ts`, `useAniListBrowse.ts`,
  `useCardDownloads.ts` (+ test).
- `app/components/deck/DeckAddAnimeModal.vue`, `DeckFilterCardsModal.vue`;
  `app/components/study/StudyFilterForm.vue`.
- `app/components/settings/SettingsAnimeDetailsControl.vue`,
  `SettingsAnimeThemesLinksControl.vue`, `SettingsAnimeThemesMatchControl.vue`,
  `SettingsCardSourceControl.vue`, `SettingsCoverArtControl.vue`,
  `SettingsLibraryHealth.vue`; the update block in `app/pages/settings.vue`.
- `app/components/party/PartyQueueSearch.vue`, `PartyEndlessPanel.vue`,
  `PartyMainAppLink.vue`.

## Data / contracts

- No server, schema, or route change. The contract consumed is 107b's: HTTP
  409, `data.code === "OFFLINE_MODE"`, and `useNetworkMode().offlineMode`
  (`true` / `false` / `null`).
- `isOfflineModeError(err)` (load-bearing for 107d): the one way client code
  recognizes the offline refusal.
- `OfflineNotice.vue` (load-bearing for 107d): props `message?: string`,
  `settingsHref?: string | null`; default slot replaces the message, `action`
  slot replaces the Settings link.
- Mode `null` (unknown, read failed) is treated as online for user-started
  searches; the server still refuses, and the error fallback shows the notice.
  Only `true` skips a request.

## Testing

- Unit (gate is on): `isOfflineModeError` for the H3 shape, the `$fetch`
  nested shape, a plain 409 without the code, a network error, and
  non-objects; the download error mapping in `useCardDownloads`.
- UI surfaces ride on browser evidence: network logs showing no
  `/api/lookup/*` or Party catalog requests offline, and screenshots of each
  notice. `bun run test` and `bun run build` for every step.

## Notes for the AI

- Never hide or disable a local action to make the UI look tidier. If the
  server would allow it offline, it stays usable.
- Keep one notice per surface. The nav dropdown in particular must not stack
  two identical notices for Anime and Artists.
- `CardAddArtistResults` is shared with the artist deck page; change it once.
- Party doors cannot reach `/settings`; use `PartyMainAppLink` there.
- No em dashes in copy, comments, or commits (`coding-standards.md`).

## Evidence (step 7)

Run against an isolated dev server (`GAQ_SRS_DATA_DIR` in a scratch directory,
port 3001) behind a request-logging proxy, driven with `bun run measure`.

- Offline `/cards?q=naruto`: only `/api/cards` was requested (no `/api/lookup/*`);
  the Anime, Songs and Artists groups each showed a neutral notice, no `.inline-error`.
- Offline Browse by filters opened on "Search my library". Offline Import list
  showed the notice and no username form.
- Offline Settings > Media library: cover-art buttons disabled, notice shown
  (with no "Open Settings" link, since the user is already there).
- Offline mode off: the same search requested `anilist-search`, `artist-search`
  and `song-search` and showed no notice.
- `bun run test` (2461 passed) and `bun run build` pass.

**Not browser-verified:** the Browse modal's "Add from AniList" tab, the nav
search dropdown, deck modals, the Study list filter, the Library health
Re-source button, update "Check again", the metadata refresh, and the whole
Party host panel (needs the `gaq-party` doors and a host login). Those rest on
code review, the build, and the unit tests only.
