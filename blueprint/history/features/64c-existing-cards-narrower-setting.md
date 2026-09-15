# Feature: Clip source setting - existing cards under a narrower setting

**From build-plan:** feature 64c (parent: 64. Clip source setting)
**Status:** verified

## Goal

64a refuses a blocked URL at fetch time; 64b stops a blocked URL from being
stored on a *new* card. Neither touches a card that already holds one from
before the setting narrowed, or from before 64b existed. Today that card's
`StudyMediaPlayer` (Study and Preview both share it) blindly tries whichever
kind `mediaKind` picks - unaware the setting exists - hits `/api/media/stream`'s
403, and shows a generic "failed to load" veil even when the *other* kind on
the same card would have played fine. 64c makes the player itself
clip-source-aware: skip a blocked kind and play the other one when it's
allowed, and when nothing on the card is allowed, show the existing error
state with a hint toward the one thing that can actually fix it - the 60c
re-source action - which currently doesn't know about the setting either and
would make some cards *worse* if used carelessly (see the resolved decision
below).

## In scope

- A client-side `ClipSource` type + `isClipUrlAllowed`/`isRemoteUrlAllowed` in
  a new `app/utils/clipSource.ts` - a by-hand duplicate of
  `server/utils/clipSource.ts`'s host-mapping logic, per the F-09 convention
  84b's own archive flagged as load-bearing for this feature.
- `resolveRemotePrefetchUrl()` (`app/utils/mediaSource.ts`, feature 41's
  lookahead/on-mount cache warming) becomes clip-source-aware, so it never
  requests a prefetch for a host the setting excludes and prefers whichever
  kind is actually allowed - mirroring `StudyMediaPlayer`'s own logic, which
  its existing comment already says to keep in sync.
- `StudyMediaPlayer.vue`'s `hasVideoSource`/`hasAudioSource` (and therefore
  `mediaKind`, and everything downstream of it - `cardSrc`, `showCoverArt`,
  the audio/video fallback buttons) become clip-source-aware: a remote URL on
  an excluded host no longer counts as an available source. A local file
  always counts, regardless of the setting.
- A new hint in `StudyMediaPlayer`'s existing error veil, shown only when the
  kind that failed to load has nothing else to try (its only source is a
  blocked remote URL) - explains why, links to the Clip source setting and to
  the re-source action, and replaces the existing Download/Redownload
  fallback buttons for that specific case, since clicking either is
  guaranteed to hit the same 403 a blocked host already produces.
- Threading a `clipSource` prop end-to-end: `study/index.vue`,
  `cards/index.vue`, `decks/index.vue` (each already fetches
  `/api/media-library` for `playbackMode`; add `clipSource` to the same
  fetch) down through `CardPreviewModal.vue` and into `StudyMediaPlayer.vue`,
  and a new third parameter on `useStudySession()` for the upcoming-cards
  lookahead prefetch.
- `cardSourceRefresh.ts` (60c) stops proposing or performing a swap that the
  *current* setting would immediately re-block - see the resolved decision
  below for exactly what this does and does not do.
- `SettingsCardSourceControl.vue` shows a distinct message when the setting
  makes the re-source action unavailable, instead of conflating that with
  "every card already uses the faster source."

## Out of scope

- Feature 8's standalone per-row download buttons on the `/cards` and
  `/decks` list rows, and the download actions inside the add-candidate
  groups (`CardAddAnimeResults.vue` and siblings) for an *already-added*
  card. None of those are Study or Preview. A blocked host there still
  surfaces 64a's plain 403 message via the existing `downloadError` state -
  acceptable degraded behavior this sub-feature doesn't change.
- Making `cardSourceRefresh.ts` bidirectional (resolving a replacement
  *animethemes.moe* URL for a card stuck on a blocked AMQ host under
  `"animethemes"`-only mode). Out of scope - see the resolved decision.
- Rewriting or deleting any URL already stored on a `Card`. Every change here
  either reads the setting to decide what to *attempt* (playback, prefetch)
  or gates whether 60c's existing write path runs at all; nothing new is
  ever written to a card except through that same pre-existing path.
- Any change to `onError`'s failure message text, `isClipUrlAllowed`'s host
  matching, or `/api/media/stream`/`/api/media/prefetch`/`/api/cards/download`'s
  64a enforcement. All reused exactly as they are.
- `server/api/lookup/source-refresh.post.ts` itself - a thin wrapper with
  nothing to change; the gate lives in `cardSourceRefresh.ts`.

## Resolved decisions

**The 60c re-source action stays one-directional; 64c only makes it safe.**
`cardSourceRefresh.ts` only ever *finds* cards with a stored animethemes.moe
URL and only ever *writes* an AnisongDB/AMQ replacement - that's its entire
mechanism (`listSourceRefreshCandidates()`'s query literally filters on
`like(..., "%animethemes.moe%")`). Under the default `"anisongdb"` setting
that's exactly the fix a blocked card needs. Under `"animethemes"`-only mode
it's the opposite of a fix: animethemes.moe is the *allowed* host in that
mode, so swapping a working card onto AMQ would newly break it. Building a
real reverse resolver (AMQ -> animethemes.moe, needing an animethemes.moe
GraphQL lookup by title instead of AnisongDB) is a materially bigger, separate
piece of work than "make existing data degrade gracefully," so 64c does the
minimal safe thing instead: skip every candidate when the current setting
would immediately re-block the replacement. In `"animethemes"`-only mode,
`listSourceRefreshCandidates()` (and therefore `countCardsToRefresh()`)
returns nothing.

**The player's hint is generic, not conditional on which fix applies.**
Whether "re-source this card" or "widen the setting" is the actual working
fix depends on which host is blocked and which mode is active - distinguishing
that in the hint's wording would need duplicating the same host-vs-mode logic
a third time for copy purposes alone. The hint names both possible fixes and
links to both settings locations; the user can tell at a glance which one
applies to their own setting.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Client clip-source predicate (pure logic + test)** - new
  `app/utils/clipSource.ts` exporting `ClipSource`, `isClipUrlAllowed(url,
  clipSource)`, and `isRemoteUrlAllowed(url: string | null, clipSource)` (the
  null-safe convenience wrapper later steps use), with `clipSource.test.ts`
  beside it, mirroring `server/utils/clipSource.test.ts`'s cases (an AMQ URL,
  an animethemes.moe URL, a lookalike host, `http:`, an unparseable string,
  across all three modes). *Done when:* `bun run test` passes.
- [x] **Step 2 - Clip-source-aware prefetch resolution (pure logic + test)** -
  `resolveRemotePrefetchUrl()` in `app/utils/mediaSource.ts` gains a third
  `clipSource: ClipSource = "anisongdb"` parameter (default keeps every
  existing caller compiling and behaving exactly as today until step 3 wires
  the real value through), and skips a kind whose only remote source is
  blocked - preferring the other kind when it's allowed, returning `null`
  when neither is. New `mediaSource.test.ts` (first test for this function)
  covers the existing behavior plus the new clip-source cases. *Done when:*
  `bun run test` passes, including a case where video is blocked and audio is
  allowed (returns the audio URL) and one where both are blocked (returns
  `null`).
- [x] **Step 3 - Thread `clipSource` end-to-end (plumbing only)** - adds
  `clipSource` to the existing `/api/media-library` fetch type in
  `study/index.vue`, `cards/index.vue`, `decks/index.vue`; each derives
  `const clipSource = computed(() => data.value?.clipSource ?? "anisongdb")`
  and passes `:clip-source="clipSource"` to its `<CardPreviewModal>` (all
  three) and, in `study/index.vue`, its own `<StudyMediaPlayer>` too.
  `CardPreviewModal.vue` gains a `clipSource?: "anisongdb" | "both" |
  "animethemes"` prop and forwards it to its internal `<StudyMediaPlayer>`.
  `StudyMediaPlayer.vue` gains the same prop, used for now only in its
  existing `prefetchUrl` computed (replacing step 2's default with the real
  value). `useStudySession()` gains a third `clipSource: ComputedRef<...>`
  parameter, used in its own upcoming-cards prefetch loop. No behavior change
  to what actually plays yet - `hasVideoSource`/`hasAudioSource` are
  untouched until step 4. *Done when:* `bun run build` passes with no prop
  type errors; in the browser with the Network tab open, narrowing Clip
  source to `"animethemes"` on `/settings` and opening `/study` shows the
  lookahead prefetch (`POST /api/media/prefetch`) requesting only
  animethemes.moe hosts for upcoming cards that have one, confirming the real
  setting is flowing through even though the current card's own playback
  choice hasn't changed yet.
- [x] **Step 4 - `hasVideoSource`/`hasAudioSource` become clip-source-aware**
  - both computeds in `StudyMediaPlayer.vue` now check `isRemoteUrlAllowed`
  for the remote half of their `||` (a local path still always counts). Every
  downstream consumer (`mediaKind`, `cardSrc`, `showCoverArt`, the "Use audio
  for this card" button's `hasAudioSource` guard) inherits the fix with no
  further change. *Done when:* using `PATCH /api/cards` to give a test card a
  mixed pair (video on an animethemes.moe URL, audio on an AMQ URL): with
  Clip source set to `"animethemes"`, the card plays its video normally (no
  error) both in `/study` and in that same card's Preview from `/cards`;
  switched to `"anisongdb"` and reloaded, the same card falls back to audio
  (cover art shown, no error) in both surfaces instead of showing the video
  failure veil. Restore the card's original URLs and the default setting
  afterward.
- [x] **Step 5 - Error veil hint for a fully-blocked card** - a new
  `failedKindBlocked` computed (true when `failedKind`'s own source is a
  remote-only URL that `isRemoteUrlAllowed` rejects); the existing
  `.download-section` block (Download/Redownload buttons) only renders when
  `!failedKindBlocked`, and a new sibling block renders instead when it is
  true: a short message naming the Clip source setting and the re-source
  action, linking to `/settings?section=playback` and
  `/settings?section=library`. *Done when:* with the same mixed-source test
  card from step 4, set both its URLs to hosts the current setting excludes
  (e.g. Clip source `"anisongdb"`, both URLs on animethemes.moe) - both
  `/study` and that card's Preview show today's existing error message plus
  the new hint, with no Download/Redownload button offered. A card whose
  failure is a genuinely broken *allowed* URL (unrelated to the setting)
  still shows the original Download/Redownload actions unchanged.
- [x] **Step 6 - `cardSourceRefresh.ts` honours the setting** -
  `listSourceRefreshCandidates()` returns `[]` immediately when
  `getClipSource() === "animethemes"` (its one write target, AMQ, is
  excluded in that mode); `countCardsToRefresh()` inherits this for free
  since it already calls `listSourceRefreshCandidates()`. Extends the
  existing `cardSourceRefresh.test.ts` with cases across all three modes.
  *Done when:* `bun run test` passes, including a case that inserts a
  `mediaLibrarySettings` row with `clipSource: "animethemes"` and asserts
  `listSourceRefreshCandidates()` returns `[]` even with real candidate rows
  present, and a case confirming `"anisongdb"`/`"both"` behave exactly as
  today (regression coverage for the existing suite).
- [x] **Step 7 - Settings panel distinguishes "blocked by setting" from
  "already optimal"** - `SettingsCardSourceControl.vue` gains a `clipSource`
  prop (passed from `settings.vue`, which already fetches it); when
  `clipSource === "animethemes"` the panel shows a message explaining the
  action is unavailable under the current setting instead of "Every card
  already uses the faster source." *Done when:* in the browser, `/settings`
  -> Media library with Clip source set to `"animethemes.moe only"` shows the
  new message and no enabled button, even when
  `animethemesSourcedCardCount` is 0; switching back to `"AnisongDB only"`
  restores today's existing count/button behavior.

## Files / areas

- `nuxt-app/app/utils/clipSource.ts` (new) + `clipSource.test.ts` (new)
- `nuxt-app/app/utils/mediaSource.ts` + `mediaSource.test.ts` (new)
- `nuxt-app/app/components/study/StudyMediaPlayer.vue`
- `nuxt-app/app/components/card/CardPreviewModal.vue`
- `nuxt-app/app/composables/useStudySession.ts`
- `nuxt-app/app/pages/study/index.vue`
- `nuxt-app/app/pages/cards/index.vue`
- `nuxt-app/app/pages/decks/index.vue`
- `nuxt-app/server/utils/cardSourceRefresh.ts` + `cardSourceRefresh.test.ts`
- `nuxt-app/app/components/settings/SettingsCardSourceControl.vue`
- `nuxt-app/app/pages/settings.vue`

## Data / contracts

- Load-bearing (client-side, mirrors the server shape from 64a/64b):
  ```ts
  type ClipSource = "anisongdb" | "both" | "animethemes";
  function isClipUrlAllowed(url: string, clipSource: ClipSource): boolean;
  function isRemoteUrlAllowed(url: string | null, clipSource: ClipSource): boolean;
  ```
- `resolveRemotePrefetchUrl(card, audioOnly = false, clipSource: ClipSource = "anisongdb"): string | null`
  - new third parameter, backward-compatible default.
- `useStudySession(scope, audioOnly, clipSource: ComputedRef<ClipSource>)` -
  new third parameter; its one call site (`study/index.vue`) is updated in
  the same step that adds it.
- `StudyMediaPlayer` and `CardPreviewModal` both gain an optional
  `clipSource?: "anisongdb" | "both" | "animethemes"` prop, inlined per the
  existing `playbackMode` convention rather than importing the type (every
  page in scope already inlines that literal union instead of sharing it).
- No schema, migration, or server route changes. Everything here either
  reads the setting client-side or gates the existing 60c write path.

## Testing

- Test runner is configured (Vitest). Steps 1, 2, and 6 ship or extend
  pure-logic tests - a predicate, a URL-selection function, and a
  DB-backed candidate-listing function respectively, all with clear
  right/wrong answers per the coding-standards scope rule.
- Steps 3, 4, 5, and 7 are Vue components and cross-page wiring - no new unit
  tests (no existing test file covers `StudyMediaPlayer.vue`,
  `CardPreviewModal.vue`, or `SettingsCardSourceControl.vue`, consistent with
  every prior feature touching them). Verified with the browser
  evidence described in each step's done-when, plus `bun run build` for
  type-safety across the prop threading.
- Final gate: `bun run test` and `bun run build` in `nuxt-app/`.

## Notes for the AI

- `clipSource` is an optional prop everywhere it's threaded (`StudyMediaPlayer`,
  `CardPreviewModal`) so an existing call site that hasn't been updated yet
  doesn't hit a type error mid-refactor. Treat a missing value as `"anisongdb"`
  consistently at every read site (`props.clipSource ?? "anisongdb"`) - that's
  the real server-side default, so an un-wired caller behaves exactly like the
  common case rather than silently disabling the setting.
- Reuse `isRemoteUrlAllowed`/`isClipUrlAllowed` everywhere a client-side
  allowance check is needed - don't re-implement the host mapping a third
  time. Keep the host list itself (`animemusicquiz.com` ->
  anisongdb/both, `animethemes.moe` -> animethemes/both) byte-for-byte
  identical to `server/utils/clipSource.ts`; a drift between the two would
  make the player and the server disagree about what's playable.
- `hasVideoSource`/`hasAudioSource`'s existing comments in
  `StudyMediaPlayer.vue` already explain several subtle constraints (why
  `audioOnly`/`audioFallbackChosen` are safe to read reactively, why a
  mid-playback kind swap caused the feature 18/32 rollbacks) - preserve that
  reasoning; this feature only adds a third condition to the `||`, it
  doesn't change any of the existing ones.
- Don't touch `useCardDownloads.ts` (`canDownload`/`canRetryDownload`/
  `hasAnyDownloadableSource`). It's shared by five other components outside
  this feature's scope; `failedKindBlocked` in step 5 is a local template
  guard in `StudyMediaPlayer.vue` only, not a change to that composable.
- `cardSourceRefresh.ts`'s gate is a single early return in
  `listSourceRefreshCandidates()` - resist the urge to also touch
  `refreshCardSources()`'s own loop; it already does nothing when its
  candidate list is empty.
- No em dashes in code comments or copy; use `-` for separators, matching
  the rest of the codebase's inline hint text (see the existing "Set a
  default download folder" hint next to where step 5's new hint lands).
- Server routes only touch settings through `mediaLibrary.ts`; components
  stay presentation-only. No hard-coded colors; scoped styles on
  `var(--token)`, reusing existing hint/error class patterns
  (`.download-hint`, `.control-error`) rather than inventing new ones per
  file where an equivalent already exists in that same file.
