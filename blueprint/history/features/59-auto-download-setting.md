# Feature: Auto Download setting

**From build-plan:** feature 59
**Status:** verified

## Goal

A persistent Settings toggle (default off) that automatically downloads a
card's clip into the local media library while it's loaded in Study or
Preview - video when Playback mode (feature 43) is Auto and the card has a
video source, audio otherwise - so cards fill in their local files over time
without a manual per-card Download click. Complements, rather than
duplicates, feature 41's stream cache: if the clip is already cached from
playback/prefetch, the existing download machinery (feature 8, extended by
the recent `recreate-missing-download-folder` fix) reuses that cached copy
instead of re-fetching over the network.

## In scope

- A new `autoDownload` boolean column on `MediaLibrarySettings` (default
  `false`), with a getter/setter in `mediaLibrary.ts` and a
  `POST /api/media-library/auto-download` route, mirroring feature 43's
  `playbackMode` plumbing exactly.
- `GET /api/media-library` returns the new field.
- A Settings UI toggle in the existing "Playback" section (`settings.vue`),
  next to the Playback mode control.
- Trigger logic in `StudyMediaPlayer.vue` - the one component shared by
  `/study` and `CardPreviewModal` - that silently calls the existing
  download-and-patch mechanism (`retryDownload`, added by feature 42) once
  per card, exactly when: Auto Download is on, a default download folder is
  configured, and the card doesn't already have a local file for its
  resolved media kind (video or audio, from the same `mediaKind` computed
  the player already uses for playback and feature 44's cover-art logic).
- Threading the new setting from all three existing call sites that already
  fetch `/api/media-library` and pass `audioOnly`/`hasDefaultDownloadFolder`
  down: `study/index.vue`, `cards/index.vue`, `decks/index.vue`.

## Out of scope

- Any UI feedback for an in-progress auto-download beyond what already
  exists (the download-progress state feature 42 added is silent unless a
  playback error is also showing - auto-download does not add a new visible
  indicator). Purely additive later if wanted.
- Retroactively downloading anything outside a currently-loaded card (no
  bulk/background sweep of the whole library). Feature 37b's "Download all"
  already covers explicit bulk downloads.
- Changing feature 41's prefetch/cache behavior, or feature 43's playback
  mode semantics - this only adds a new consumer of the existing `mediaKind`
  resolution and the existing per-card download endpoint.
- Any confirmation dialog or storage-usage warning beyond the Settings
  section's own hint text - consistent with how `streamCacheMaxBytes` and
  `playbackMode` are already presented with plain hint text, no extra modal.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Data model + settings API** - add `autoDownload: integer("auto_download", { mode: "boolean" }).notNull().default(false)` to `mediaLibrarySettings` in `server/db/schema.ts`; generate the migration (`bun run db:generate` from `nuxt-app/`); add `getAutoDownload()`/`setAutoDownload(value: boolean)` to `server/utils/mediaLibrary.ts` (same shape as `getPlaybackMode`/`setPlaybackMode` - setter validates `typeof value === "boolean"`); add `autoDownload: getAutoDownload()` to `GET /api/media-library`'s response; add `server/api/media-library/auto-download.post.ts` mirroring `playback-mode.post.ts`. *Done when:* `POST /api/media-library/auto-download -d '{"enabled":true}'` returns `{"autoDownload":true}`, and a subsequent `GET /api/media-library` reflects it; the migration applies cleanly on server boot.
- [x] **Step 2 - Settings UI toggle** - add `SettingsAutoDownloadControl.vue` (checkbox, mirroring `SettingsPlaybackModeControl.vue`'s structure/styling) that POSTs to the new route and emits `saved`; wire it into `settings.vue`'s existing Playback section with a one-line hint ("Automatically downloads each card's clip - video or audio, per Playback mode - into your media library as you study or preview it."); extend `settings.vue`'s `useFetch` response type with `autoDownload: boolean`. *Done when:* toggling it in `/settings` persists across a reload (visible via `GET /api/media-library`), screenshot showing the toggle in the Playback section.
- [x] **Step 3 - Trigger logic in StudyMediaPlayer, wired into /study** - add an `autoDownload?: boolean` prop to `StudyMediaPlayer.vue`; add a computed `autoDownloadTarget` (`props.autoDownload && props.hasDefaultDownloadFolder && canDownload(props.card, mediaKind.value) ? mediaKind.value : null`, placed after the existing `retryDownload`/`canDownload` destructure so it can call `retryDownload` directly) plus an `onMounted`/`watch` pair that calls `retryDownload(target)` when it's non-null, matching the existing prefetch trigger's structure; extend `study/index.vue`'s `useFetch<...>("/api/media-library")` response type with `autoDownload: boolean`, add an `autoDownload` computed the same way `hasDefaultDownloadFolder`/`persistedAudioOnly` already are, and pass `:auto-download="autoDownload"` into its `<StudyMediaPlayer>`. *Done when:* with Auto Download on and a default download folder configured, loading a remote-only card on `/study` results in its local path for the resolved kind being set automatically within a few seconds (verified via `GET /api/cards?q=...` showing the new local path), with no click on Download; toggling Auto Download off leaves a remote-only card's local path untouched after loading it.
- [x] **Step 4 - Extend to Preview (/cards and /decks)** - `cards/index.vue` uses `StudyMediaPlayer` directly for its inspector rail, so it just needs step 3's page-level wiring repeated (extend the `useFetch` type, add the `autoDownload` computed, pass `:auto-download="autoDownload"`). `decks/index.vue` instead renders `CardPreviewModal` as a wrapper, so `CardPreviewModal.vue` first needs its own `autoDownload?: boolean` prop added and forwarded to its inner `<StudyMediaPlayer>` (the same way it already forwards `audio-only`/`has-default-download-folder`), then `decks/index.vue` gets the same page-level wiring as the other two, passing `:auto-download="autoDownload"` into `<CardPreviewModal>`. *Done when:* with Auto Download on, opening a remote-only card's Preview from `/cards` and from a deck's detail view on `/decks` each auto-downloads it the same way `/study` does in Step 3.

## Files / areas

- `nuxt-app/server/db/schema.ts` + new migration under `server/db/migrations/`
- `nuxt-app/server/utils/mediaLibrary.ts`
- `nuxt-app/server/api/media-library.get.ts`
- `nuxt-app/server/api/media-library/auto-download.post.ts` (new)
- `nuxt-app/app/components/settings/SettingsAutoDownloadControl.vue` (new)
- `nuxt-app/app/pages/settings.vue`
- `nuxt-app/app/components/study/StudyMediaPlayer.vue`
- `nuxt-app/app/components/card/CardPreviewModal.vue`
- `nuxt-app/app/pages/study/index.vue`
- `nuxt-app/app/pages/cards/index.vue`
- `nuxt-app/app/pages/decks/index.vue`

## Data / contracts

- `MediaLibrarySettings.autoDownload: boolean`, default `false` - new column,
  singleton row like every other setting here.
- `GET /api/media-library` response gains `autoDownload: boolean`.
- `POST /api/media-library/auto-download` - body `{ enabled: boolean }`,
  returns `{ autoDownload: boolean }` or `{ error: string }` on invalid input
  (400), matching `playback-mode.post.ts`'s shape exactly.
- `StudyMediaPlayer.vue` gains one new prop: `autoDownload?: boolean`. No
  changes to its existing emits (`local-path-updated` already exists and is
  reused as-is). `CardPreviewModal.vue` gains the same prop, forwarded
  straight through to its inner `StudyMediaPlayer`.

## Testing

`bun run test` (Vitest) is configured, so in-scope logic needs a test, but
every new piece here is either a thin DB read/write wrapper matching
untested siblings (`getPlaybackMode`/`setPlaybackMode`,
`getBoxOneStreakRequired`/`setBoxOneStreakRequired` - none of which have
dedicated tests, since there's no branching worth asserting beyond "not a
boolean" input validation) or Vue component/page wiring, which this
project verifies with browser and build evidence rather than unit tests
(see `coding-standards.md`'s scope rule and how features 41-46's client
trigger logic were verified). No new test file is planned; each step's
done-when is checked via `curl`/API response, a `/settings` screenshot, and
live card-state verification in the browser, consistent with how feature 43
(the closest precedent) was verified.

## Notes for the AI

- Reuse `retryDownload`/`canDownload`/`downloadMedia` from
  `useCardDownloads()` as-is inside `StudyMediaPlayer.vue` - do not add a
  second download code path. The auto-download trigger is just an
  automatic caller of the same function the manual "Download video/audio"
  buttons in the error-veil already call.
- Mirror the existing prefetch trigger's shape exactly (`computed` ->
  `onMounted` + `watch`, no `immediate` on the watch) so behavior on card
  change inside `CardPreviewModal` (no remount) and `/study` (remounts per
  card) stays consistent with how prefetch already handles both.
- Changing the Auto Download setting mid-session never affects a card
  already loaded - it's read once via the `autoDownload` prop, the same
  "no reactive mid-playback change" rule feature 43's `audioOnly` already
  follows, for the same reason (avoiding the overlapping-audio failure
  class from features 18/32).
- `canDownload` already guards against re-downloading a card that has a
  local path or lacks a remote source for the target kind - no extra
  bookkeeping needed to avoid duplicate downloads or wasted attempts on
  fully-local cards.
- Follow `coding-standards.md`: Drizzle migration via `bun run db:generate`,
  never a hand-written `ALTER TABLE`.
