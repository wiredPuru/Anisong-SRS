# Feature: Playback mode setting (Auto / Audio only)

**From build-plan:** feature 43
**Status:** verified

## Goal

A persistent Settings-page default - Auto or Audio only - that governs both
what plays across the app and what feature 41's local stream cache
fetches/stores going forward. Audio only forces every card to play from its
audio source (local or remote) whenever one exists, and stops the cache from
prefetching or storing video, trading video playback for meaningfully lower
local storage/bandwidth use. This is a third attempt at an idea tried twice
before (feature 18, built then rolled back for a real double-audio bug when
its forced mode changed reactively mid-playback; feature 32, spec'd then
abandoned) - this version resolves the setting once, from an `await`ed fetch
completed before a card's player ever mounts, and is editable only from
`/settings` (never inline on `/study`), so there is no live channel that
could change it while a session is running.

## In scope

- New `playbackMode` column on `MediaLibrarySettings` (`"auto" | "audioOnly"`,
  default `"auto"`), returned by `GET /api/media-library`, set via a new
  `POST /api/media-library/playback-mode`, with a `SettingsPlaybackModeControl.vue`
  on `/settings` - the only place this can be changed.
- `StudyMediaPlayer.vue`'s `mediaKind`/`quizType` computeds take a new
  `audioOnly` prop: whenever true and the card actually has an audio source
  (local or remote), the audio element/veil is used regardless of any video
  source. A card with no audio source at all still falls back to mounting
  video for its audio track, veiled as audio-only exactly like today's
  `hideVideo` toggle already does - no new UI state, reuses the existing
  veil.
- `resolveRemotePrefetchUrl()` (`app/utils/mediaSource.ts`) - the single
  source of truth for "which URL would playback actually request," already
  shared by `StudyMediaPlayer.vue`'s own prefetch and `useStudySession.ts`'s
  next-2-cards lookahead prefetch - takes the same `audioOnly` flag, so
  Audio only stops the cache from fetching/storing video for any card that
  has an audio source, for both the current card and the lookahead.
- Wired into every surface that plays a clip: `/study` and Preview
  (`CardPreviewModal`, reused unchanged by `/cards`, `/cards/new`, and
  `/decks`).
- Resolved once per page load (an `await`ed fetch before the player first
  mounts), never updated reactively while a card's player instance is alive.

## Out of scope

- Editing this setting from within `/study` itself. Unlike
  `dailyNewCardLimit`/`boxOneStreakRequired`, which do have an inline
  popover there, this is deliberately Settings-page-only - the point is
  that there is no live channel that could change the value mid-session,
  which is exactly the mechanism that caused feature 18's rollback.
- Purging already-cached video from feature 41's disk cache when switching
  to Audio only. Existing LRU eviction (or the user manually lowering the
  cache-size cap on `/settings`) is how that space gets reclaimed over
  time; no new proactive purge-by-content-type action.
- Any change to feature 8's per-card download buttons or feature 37b's bulk
  "Download all." Those stay separate, deliberate, user-triggered actions,
  untouched by this passive/automatic setting - the same boundary feature
  41 itself drew around feature 8.
- A three-way Audio-only/Video-only/Any choice (feature 32's original,
  abandoned scope). This is the two-way Auto/Audio-only choice approved for
  this attempt; "Video only" (refusing to ever fall back to audio) isn't
  part of this feature.
- Any per-scope or per-session override - one global, persistent default
  only.
- A cache-content policy independent from playback mode (e.g. "cache both
  anyway even in Audio only," or a separate "video/audio/both" cache
  toggle distinct from what plays). Considered and explicitly declined in
  favor of one unified setting before this spec was written.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `playbackMode` setting: schema, API, Settings UI** - add
  `playbackMode` (text, not null, default `"auto"`, `.$type<"auto" |
  "audioOnly">()`) to `mediaLibrarySettings` in `server/db/schema.ts`;
  generate the migration (`bun run db:generate`). Add
  `getPlaybackMode()`/`setPlaybackMode()` to `server/utils/mediaLibrary.ts`
  (reject anything other than `"auto"`/`"audioOnly"`), mirroring
  `getBoxOneStreakRequired`/`setBoxOneStreakRequired`. Add
  `server/api/media-library/playback-mode.post.ts` (body `{ mode }`, 400 on
  an invalid value) and include `playbackMode` in `GET
  /api/media-library`'s response. Add `SettingsPlaybackModeControl.vue` (a
  `<select>` with "Auto" / "Audio only", matching `settings.vue`'s existing
  default-download-folder `<select>` styling) and wire it into
  `settings.vue`'s fetch type and template, under its own "Playback" section
  next to "Streamed clip cache." *Done when:* `/settings` shows the current
  mode (Auto by default), changing it persists across a page refresh, and
  an invalid POST body 400s.

- [x] **Step 2 - `StudyMediaPlayer` and `/study` respect Audio only for the
  current card** - add an `audioOnly?: boolean` prop to `StudyMediaPlayer.vue`
  and fold it into `mediaKind`: `audioOnly && hasAudioSource ? "audio" :
  (hasVideoSource ? "video" : "audio")`; fold it into `quizType` too
  (`hideVideo || audioOnly ? "audio" : mediaKind`) so the existing
  audio-style veil covers the "no audio source, had to fall back to video"
  case the same way `hideVideo` already does. Add the same `audioOnly`
  param to `resolveRemotePrefetchUrl(card, audioOnly)` in
  `app/utils/mediaSource.ts` (prefer audio, local or remote, when
  `audioOnly` is true and an audio source exists; otherwise today's
  video-first logic unchanged), and pass it through
  `StudyMediaPlayer.vue`'s own current-card prefetch call. In
  `study/index.vue`, extend the existing `await useFetch("/api/media-library")`
  call to also read `playbackMode`, compute `const audioOnly =
  computed(() => studySettings.value?.playbackMode === "audioOnly")`, and
  pass `:audio-only="audioOnly"` into `<StudyMediaPlayer>`. *Done when:*
  with Audio only selected on `/settings`, a due card with both video and
  remote audio on `/study` shows the audio veil and mounts only an
  `<audio>` element (network tab shows no video request for the current
  card); switching back to Auto and reloading `/study` restores today's
  video-first behavior; a card with only a video source (no audio at all)
  still plays (falls back to video, veiled as audio).

- [x] **Step 3 - lookahead prefetch respects Audio only** - add an
  `audioOnly: ComputedRef<boolean>` parameter to `useStudySession(scope,
  audioOnly)`, threading it into the existing `resolveRemotePrefetchUrl(upcomingCard)`
  call in `fetchNext()`'s lookahead loop. In `study/index.vue`, reorder so
  the media-library fetch (and the `audioOnly` computed from Step 2) exists
  before `useStudySession(scope, audioOnly)` is called, since its internal
  immediate `watch` fires a fetch synchronously on setup. *Done when:* with
  Audio only selected, loading `/study` or advancing to a new card shows no
  video prefetch requests in the network tab for either of the 2 upcoming
  due cards (only audio, for whichever of them has an audio source);
  switching back to Auto restores today's video-first lookahead.

- [x] **Step 4 - Wire Preview (`CardPreviewModal`) and its three callers** -
  add a `audioOnly?: boolean` prop to `CardPreviewModal.vue`, forward it to
  its nested `<StudyMediaPlayer>`. Each of `/cards`, `/cards/new`, and
  `/decks` already independently fetches `/api/media-library` (for
  `hasDefaultDownloadFolder`) - extend each of those three fetch types to
  also read `playbackMode`, compute the same `audioOnly` boolean, and pass
  it into `<CardPreviewModal :audio-only="audioOnly">`. *Done when:* with
  Audio only selected, opening Preview on a video-capable card from any of
  the three pages shows the audio veil and requests no video, matching
  `/study`'s behavior from Step 2.

## Files / areas

- `nuxt-app/server/db/schema.ts` - new `playbackMode` column.
- `nuxt-app/server/db/migrations/` - generated migration.
- `nuxt-app/server/utils/mediaLibrary.ts` - `getPlaybackMode`/`setPlaybackMode`.
- `nuxt-app/server/api/media-library.get.ts` - include the new field.
- `nuxt-app/server/api/media-library/playback-mode.post.ts` - new route.
- `nuxt-app/app/components/settings/SettingsPlaybackModeControl.vue` - new.
- `nuxt-app/app/pages/settings.vue` - wire in the new control.
- `nuxt-app/app/utils/mediaSource.ts` - `resolveRemotePrefetchUrl()` gains
  the `audioOnly` parameter.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - new prop, updated
  `mediaKind`/`quizType`, updated prefetch call.
- `nuxt-app/app/pages/study/index.vue` - extends its media-library fetch,
  computes `audioOnly`, reorders around `useStudySession`, passes the prop.
- `nuxt-app/app/composables/useStudySession.ts` - new `audioOnly` parameter.
- `nuxt-app/app/components/card/CardPreviewModal.vue` - new prop, forwards
  to `StudyMediaPlayer`.
- `nuxt-app/app/pages/cards/index.vue`, `nuxt-app/app/pages/cards/new.vue`,
  `nuxt-app/app/pages/decks/index.vue` - extend their existing
  media-library fetch, pass `audioOnly` into `<CardPreviewModal>`.

## Data / contracts

- Schema change: `mediaLibrarySettings.playbackMode` (text, not null,
  default `"auto"`, values `"auto" | "audioOnly"`), via a Drizzle migration
  applied automatically on server boot.
- `resolveRemotePrefetchUrl(card, audioOnly = false)` - existing shared
  contract (feature 41), signature extended with a second, defaulted
  parameter so it stays backward compatible; both real call sites are
  updated to pass the real value explicitly.
- `useStudySession(scope, audioOnly)` - existing composable signature
  gains a second required parameter.

## Testing

No test runner is configured for this project yet (no `test` command in
`AGENTS.md`), so this rides on manual/browser evidence, not unit tests:

- Verify each step's done-when above directly in the running app.
- Confirm a card with only a remote video source (no audio at all) still
  plays correctly in Audio only mode (falls back to video, veiled as
  audio) on both `/study` and Preview.
- Confirm switching the setting back to Auto and reloading restores
  today's exact existing behavior (video-first) everywhere - this feature
  must not regress the default path.
- Confirm the setting has no control on `/study` itself - it can only be
  changed via `/settings`.
- Run the project's build (`bun run build`) as the final check.
- If a test runner is added later, `resolveRemotePrefetchUrl()`'s branching
  (given `audioOnly` and various local/remote/video/audio combinations,
  which URL) is a good candidate for a focused unit test - pure logic with
  a clear right answer, same note feature 41's own spec left for its
  eviction-selection logic.

## Notes for the AI

- The load-bearing safety property, worth restating: `audioOnly` must be
  resolved from an `await`ed fetch that completes *before* any
  `StudyMediaPlayer` in that page's tree first mounts, and must never
  change reactively while a card's player instance is alive. This is why
  Step 1 makes the setting Settings-page-only (no inline `/study` control
  to create a live edit channel), and why Step 3 explicitly reorders
  `study/index.vue` so the fetch resolves before `useStudySession` is
  called - its internal immediate `watch` fires synchronously on setup.
  Do not add any mechanism that lets `audioOnly` change after a
  `StudyMediaPlayer` has mounted for a given card. This is exactly the
  mechanism that broke feature 18 (see
  `blueprint/history/rollbacks/2026-08-29-18-per-scope-quiz-mode-preference.md`).
- Reuse the existing `hideVideo`/`quizType` veil mechanism for the
  "audio-only but no audio source exists" fallback - don't build new UI for
  it.
- `resolveRemotePrefetchUrl()` is the single source of truth for "which URL
  would playback actually request" (feature 41's own note) - keep
  `mediaKind`'s logic and this function's logic in sync; don't let them
  drift into two different derivations of the same decision.
- Match the existing per-setting pattern exactly (`SettingsBoxOneStreakControl.vue`,
  `SettingsStreamCacheSizeControl.vue`, and their routes) for Step 1's new
  control and route, rather than inventing a new shape.
