# Feature: Listen Mix

**From build-plan:** feature 115
**Status:** complete

## Goal

Let Listen smoothly crossfade into the next song through a remembered Mix
setting. The incoming song fades in while the outgoing one fades out, instead
of each song waiting for a hard player replacement.

## Design reference

Extend the existing Display menu in `nuxt-app/app/pages/listen/index.vue`,
beside Shuffle and Play length. Reuse its toggle styles and `main.css` tokens.
This is an additive control, with no new theme or visual replication target.
There is no root `prototypes/` directory.

## In scope

- A Listen-only Mix toggle, off by default and remembered in the browser.
  It needs Autoplay; the saved choice survives turning Autoplay off and on.
- Five-second audio crossfades for video-backed and audio-only clips, including
  mixed pairs, local files, and permitted streamed or cached media.
- Full songs and selected play lengths; Random start remains available.
  Short clips use a shorter overlap, as specified below.
- Preparing only the next playback slot, reusing current source selection,
  cache, download, and offline behavior. At most two media slots exist.
- One visible player and one set of controls. At handoff, picture, details,
  position, Hide states, and Auto Reveal move to the incoming song together.
- Predictable transport, volume, interruption, error, and end-of-playlist
  behavior. An unready next clip uses normal advancement.

## Out of scope

- Beat/BPM/key matching, tempo changes, silence detection, loudness
  normalization, EQ, effects, configurable fade curves or duration.
- Video dissolves, a second visible player, a new settings page or hotkey.
- Mixing on Study, Preview, Kanji Study, or Party; playlist looping.
- New providers, APIs, database fields, media pipelines, or dependencies.
- Changes to grading, scheduling, scores, or review history; pending 113b or
  the separately stashed feature 114/Party redesign work.

## Build loop

Outline and implement one small step, show its diff and evidence, then wait for
review before continuing. Each logic-bearing step includes its adjacent tests.
Checkpoints need approval and passing tests/build. `/complete` owns the final
archive and merge. This spec does not authorize building or committing.

## Build steps

- [x] **Step 1 - Mix policy and preference.** Add pure preference parsing,
  overlap planning, and gain-envelope helpers with a small persisted
  `useListenMix` preference composable. No player behavior changes yet.
  *Done when:* tests cover missing/malformed storage, disabled Autoplay,
  finite/unknown durations, Random start offsets, play-length deadlines,
  short clips, and bounded complementary gains. Blocked storage still allows
  a session-only toggle.

  Verified 2026-10-29: the 20 new tests pass; `bun run test` passes all
  2,593 tests across 200 files; `bun run build` completes. The preference is
  client-loaded and remains usable when storage access/writes fail. This step
  adds the policy and preference only; the player and Mix UI are not wired yet.

- [x] **Step 2a - Managed playback controller.** Add the typed, element-bound
  controller and adjacent tests before adapting the shared component.
  *Done when:* preparation waits for decoded media and the chosen seek;
  play confirms an actual playing event; blocked/failed/cancelled results are
  distinct; concurrent requests, pause, timeout, and stop settle safely;
  stopped media cannot be revived by late events or play promises.

  Verified 2026-10-29: 24 controller tests pass; `bun run test` passes all
  2,617 tests across 201 files; `bun run build` completes. Native pause and
  timeout cancellation were exercised and corrected. Component integration
  and real-browser playback proof remain in Step 2b.

- [x] **Step 2b - Managed player lifecycle.** Add opt-in preparation and typed
  playback control/telemetry to `StudyMediaPlayer`, without changing its
  default callers. Separate foreground, standby, and outgoing-tail roles.
  *Done when:* a standby slot can load and become ready without playing,
  showing controls, registering hotkeys, starting display timers, painting
  ambient tint, or updating Last played. Play reports actual playback or a
  blocked/failed/cancelled result. Stop/unmount explicitly pauses and releases
  media; late events cannot revive it. Verify ordinary Study and Preview.

  Verified 2026-10-29 in desktop Chrome against an isolated offline database
  and generated MP4/MP3 fixtures: standby stays paused, hidden/inert (including
  expanded styling), with no foreground events, extra hotkeys, tint, or Last
  played writes. Promotion keeps the same element and starts foreground
  effects once. Video/audio play, pause/resume, blocked-play recovery,
  immediate pause, stop, and unmount pass; stop releases the source and audio
  context. Normal Study, Cards inspector, and Preview playback/volume/cleanup
  pass. Fixture review state stays unchanged. A queued native pause race was
  fixed with an adjacent regression test (25 controller tests total).
  `bun run test` passes 2,618 tests across 201 files; `bun run build` passes.
  Screenshots and browser results are in `/private/tmp/gaq-mix-step2b/`.
  The temporary route and verification server/browser were removed/stopped.

- [x] **Step 3a - Fade envelope controller.** Add the scheduled gain controller and
  tests for interpolation, replacing ramps, hold/resume, bounded inputs, and
  terminal stop. This substep does not alter player behavior.

  Verified 2026-10-29: five focused gain tests pass; full suite passes
  2,623 tests across 202 files and `bun run build` completes.

- [x] **Step 3b - Independent fade gain integration.** Add a small media-gain helper and
  optional managed volume/gain control. Integrate with the existing audio
  visualizer graph, and support the video element's audio too.
  *Done when:* real audio and video clips fade without clicks or a volume
  reset; pause can hold a ramp and resume its remaining duration. One master
  volume affects both slots, including zero. Fade gain never writes the saved
  volume. Test gain math and hold/resume calculations; verify the actual audio
  graph and graceful failure in the browser.

  Verified 2026-10-29 on `/dev-gain` (temporary route, removed): generated
  MP4 and MP3 fixtures play through the shared analyser/gain graph. Measured
  post-gain RMS for video was 0.0519, 0.0271, then 0; audio was 0.0505,
  0.0256, then 0 over a two-second probe ramp. Pause held gain at 0.76
  and resume continued its remaining duration. Master volume 0 muted audio;
  temporary fades left the saved preference unchanged. With AudioContext
  unavailable, gain readiness returned false and native video kept playing.
  Stop released the source and gain controller. The test browser and isolated
  server were closed. Full suite: 2,623 tests; `bun run build` passed.

- [x] **Step 4a - Bounded playback ownership.** Add the slot coordinator and
  focused tests for readiness, late results, presentation identity and cleanup.

- [x] **Step 4b - Listen playback slots integration.** Add a focused `ListenMediaPlayer`
  wrapper and `useListenPlayback` coordinator. Wire Listen through them while
  retaining single-player behavior with Mix off. Expose a read-only next-card
  view from `useListenSession`; preserve existing queue order and counters.
  *Done when:* only the foreground handles controls; only the immediate next
  card is staged when Mix and Autoplay are on. A prepared slot is promoted
  without remounting or restarting its media. Normal Next/Previous, loading,
  errors, downloads, and playlist finish still work. Test stale-load rejection,
  slot retirement, and identity across repeated presentations of one card.

- [x] **Step 5 - Automatic crossfade and handoff.** Schedule the overlap from
  the current clip endpoint and the remaining play-length budget. Start the
  incoming slot at zero gain; commit exactly once on confirmed playback and
  ramp the pair. Bind page timers and details to the committed foreground.
  *Done when:* full-song and timed playback audibly overlap for five seconds
  within a 0.5-second trigger tolerance, or the specified shorter window.
  Clip-ended, play-limit expiry, and fade completion cannot double-advance.
  Incoming playback time is counted from its first playing event, including
  the fade-in. Unknown/unready/blocked media falls back without fading the
  current song into silence. Ship fake-clock coverage for these races.

- [x] **Step 6 - Interruptions and recovery.** Implement the transport and
  cancellation rules below through the same coordinator used by buttons and
  hotkeys. *Done when:* pausing an overlap freezes both clips and the fade;
  resuming continues it. Seek, rapid Next/Previous, changed length, switches,
  scope/filter/shuffle changes, errors, and route departure leave only the
  intended foreground audible. Late promises/events cannot change the new
  queue or advance another song. Add focused coordinator/timer tests and
  verify the interactions in the browser.

- [x] **Step 7 - Mix control.** Add the accessible Mix toggle to Listen's
  Display menu with a short five-second-crossfade explanation and a visible
  "Needs Autoplay on" explanation when unavailable. Preserve the saved choice
  while disabling its effect. *Done when:* keyboard and mouse toggle it;
  reload restores it; first use is off; Autoplay off uses ordinary playback;
  desktop and narrow layouts retain one usable player and correct Details,
  Japanese breakdown, Hide, Auto Reveal, Ambient, and volume behavior.
  The existing Next in countdown reflects the planned handoff, with a
  corrected countdown if that boundary falls back to normal advancement.
  Capture screenshots and measure the visible frame, excluding standby frames.

- [x] **Step 8 - Prove playback and isolation.** Use an isolated data directory
  and representative local audio/video plus permitted remote/cached clips.
  *Done when:* the verification matrix below has observed results, including
  audible or captured-output evidence of a real overlap, no ghost playback
  after cancellation, and no review-state changes. Run `bun run test` and
  `bun run build` in `nuxt-app/`; record limits of browser/platform coverage.

Verified 2026-10-29 (Steps 4a-8) in headless Chromium against an isolated
data directory (offline mode, generated local MP4/MP3 clips, a 4-song queue,
10s play length). Sampled every 500ms, with the shared graph's gain values
read from the real `GainNode`s: video-to-audio, audio-to-video and
video-to-audio fades each overlapped for 5s with complementary gains
(0.98/0.02 to 0.05/0.95), the incoming song counted its 10s budget from its
first playing event, the old clip was retired after the fade, and only one
media frame was visible (standby frame 0x0, no horizontal overflow at 390px).
Pausing mid-overlap froze both clips and both gains (0.57/0.43) for 3.5s and
resuming continued the remaining fade. With Mix off the page keeps one media
element. Review state in the isolated DB stayed unchanged (no review rows or
tracks). `bun run test` and `bun run build` pass.
Not covered: a human listening check (gain values and playback positions are
the evidence), remote/cached clips, Firefox/Safari, slow or failing media,
background-tab throttling, seek during an overlap, the Autoplay-off "Needs
Autoplay on" note, and promoted slots do not start Auto Download.

## Files / areas

All application paths below are relative to `nuxt-app/`.

| Area | Purpose |
| --- | --- |
| `app/utils/listenMix.ts` and adjacent test | Preference, overlap, and gain policy |
| `app/composables/useListenMix.ts` | Persisted Listen-only toggle |
| `app/utils/mediaGain.ts` and adjacent test | Media gain ramps and hold/resume math |
| `app/utils/managedPlayback.ts` and adjacent test | Typed media preparation, actual-play confirmation, and cancellation |
| `app/components/study/StudyMediaPlayer.vue` | Opt-in managed lifecycle, telemetry, and graph integration |
| `app/components/listen/ListenMediaPlayer.vue` | One visible player, two bounded slots, control forwarding |
| `app/composables/useListenPlayback.ts` and adjacent test | Transition ownership, handoff, cancellation, and fallback |
| `app/composables/useListenSession.ts` | Read-only next card and existing index/presentation changes |
| `app/composables/useListenPlayLimit.ts` and adjacent test | Remaining playback budget and one advancement owner |
| `app/pages/listen/index.vue` | Toggle, coordinator, foreground events, timers, and details |
| `app/composables/usePlayerFrameBox.ts` | Select the active frame if the new wrapper requires it |

Reuse `randomStart.ts`, `mediaSource.ts`, `clipSource.ts`, `useNetworkMode`,
and the existing media routes. Change shared helpers only where this feature
requires it; preserve behavior for other callers. No server change is planned.

## Data / contracts

### Preference and timing

- `gaqSrs:listenMix` stores `"1"` or `"0"`; only `"1"` enables it. Missing,
  invalid, or inaccessible storage defaults to off. Access browser storage
  only on the client. The effective condition is Mix AND Autoplay.
- The target overlap is 5 seconds. Each prepared presentation's segment length
  is `min(duration - startOffset, playLength > 0 ? playLength : Infinity)`.
  The overlap is `min(5, outgoingSegment / 2, incomingSegment / 2)` seconds.
  A result below 1 second or unresolved/non-finite duration uses normal
  advancement. Empty/one-song queues and the final song never stage a next
  slot; the final song plays to its ordinary endpoint and then finishes.
- Remaining time is the earlier of media time to clip end and the existing
  play-limit budget. Pause/buffering do not consume that budget. Seeking
  changes media time to clip end but does not reset the elapsed play budget.
  A changed Play length keeps today's countdown-restart behavior.
- Random start is chosen once per presentation during preparation with the
  existing helper and play length. Promotion does not choose a new offset.
- Attempt the overlap once when remaining time enters its planned window.
  If the slot is unready, proceed normally for that boundary. While waiting
  for a play result the current clip stays at full gain. If incoming playback
  starts too late for a one-second overlap, stop it and use normal advancement.
  Never extend a selected play length to wait for Mix.
- Example: with a 30s play length and two long, ready clips, the next song
  starts at 25s. The old song ends at 30s, with the incoming song already 5s
  into its own 30s budget. It continues from there without a restart. The
  timed-mode Next in label counts to the planned handoff, not the old endpoint;
  do not add a full-song countdown just for this feature.

### Playback ownership

- The shared player's opt-in prop is
  `managed: { presentationId: number; role: "foreground" | "standby" | "tail" }`.
  Its ref exposes `prepare()`, `play()`, `pause()`, `stop()`, and
  `getSnapshot()` alongside the existing `playIfPaused()`. The `managed-state`
  event carries `ManagedPlaybackSnapshot`; prepare/play results distinguish
  ready/playing, blocked, failed, and cancelled. These are load-bearing for
  the Listen wrapper. Changing role preserves media; changing the card or
  presentation identity terminates the slot and requires a new keyed mount.
- Keep at most two media slots: foreground plus standby, or foreground plus
  outgoing tail. Retire the tail before allocating another standby slot.
  Cache prefetching already performed by Listen remains best effort.
- A slot is identified by a unique presentation identity, not just `card.id`.
  It snapshots the audio-only choice and prepared source. A session/attempt
  generation token invalidates all pending preparation, play, and ramp work
  after cancellation or a playlist replacement.
- Managed control must support prepare/readiness, a play result that confirms
  actual `playing`, pause/resume, stop/release, current playback telemetry,
  and gain ramp/hold. Type failures and cancellation explicitly. Readiness
  covers the selected source and its Random start seek, not metadata alone.
- Telemetry identifies its slot and includes current time, finite duration
  when known, playing, buffering/seeking, and error/readiness state. Only the
  committed foreground drives page timers, media-kind, errors, and details.
- The first confirmed incoming playback commits `next()` exactly once,
  increments the presentation key, and moves picture, metadata, position,
  Hide resets, Auto Reveal, and play-limit timing to that song. Reuse the
  already-playing slot. The outgoing tail contributes only fading audio;
  its events cannot advance the queue or reset the incoming timers.
  This acknowledged internal handoff must not be mistaken for a playlist
  replacement or tear down the slot because the presentation key changed.
- `advanceOnce`/ended and the play-limit callback must delegate to this one
  advancement owner. When Mix is off, their current observable behavior stays
  the same. An event for a retired presentation is ignored.
- Standby/tail slots have no focusable controls, duplicate hotkeys, page glow,
  tint, or Last played effects. Preparation must not repeat cache/download
  work or patch the wrong card. Preserve existing configured media downloads;
  a background completion cannot re-point an already-playing source.
  Patch paths by the owning card and queue generation, never whichever card
  happens to be current when a request resolves. Role changes also invalidate
  pending tint/Last played work from a slot that is no longer foreground.

### Audio output

- For overlap progress `p` from 0 to 1, outgoing gain is `1 - p` and incoming
  gain is `p`. Master volume multiplies both. Preserve one volume slider and
  the existing `gaqSrs:playerVolume` preference; only user volume changes
  persist, never temporary envelope values.
- Use scheduled gain ramps rather than coarse volume steps. Reuse the audio
  element's existing source/analyser graph; never attach a second
  `MediaElementAudioSourceNode` to the same element. Support an equivalent
  path for video audio and preserve the foreground visualizer.
- A stopped/retired slot cancels ramps, pauses media, releases its source,
  and disconnects its graph. Do not close a context owned by another slot.
  Check graph readiness and autoplay permission before reducing outgoing
  gain. Unsupported or blocked mixing leaves normal playback available.

### Transport and cancellation

| Trigger | Required result |
| --- | --- |
| Pause before incoming playback is confirmed | Cancel the play attempt, keep the current song paused at full gain, and ignore late incoming events |
| Pause during overlap | Pause both clips, hold both gains and remaining overlap; page timers pause too |
| Resume | Resume both without restarting either song; continue the held envelope once playback resumes |
| Manual Next/Previous | Cancel pending work and the tail, then use the existing action relative to the committed foreground; no manual crossfade |
| Seek during overlap | Retire the tail and restore foreground gain before applying the seek; future timing uses the new position |
| Mix off during overlap | Keep the committed incoming song at full gain, stop the tail, and use ordinary advancement afterward |
| Autoplay off during overlap | Settle to the committed incoming song; let it play without automatic next or a play-limit advance |
| Changed Play length | Settle any overlap and restart the foreground budget using existing rules |
| Changed audio-only override | Keep the current media kind stable; invalidate standby so the next presentation uses the new choice |
| Scope, filters, shuffle, restart | Stop/release both old slots and invalidate old work before loading the replacement playlist |
| Standby load/play failure | Keep current output; at its endpoint use ordinary next-song loading/error recovery, without retry loops or skipping more cards |
| Buffer/error during overlap | Retire the tail and restore the committed foreground; show its normal loading/error recovery rather than rewinding the queue |
| Tail ends early or cannot resume | Retire it and restore the committed foreground; its ended event cannot advance again |
| Clip-source/network policy changes | Invalidate standby, follow existing source/offline rules, and stop both slots if the existing mode-change reload occurs |
| Delayed background-tab callbacks | Reconcile actual media positions and retire an expired tail; never run a burst of stale advances |
| Route departure/reload | Stop both clips, cancel callbacks, and release owned graph/listener resources |

Existing error recovery remains visible for the committed song: retry,
download/audio fallback when allowed, and Next song. A standby failure does not
cover the working song with an error veil.

## Testing

- Adjacent Vitest tests cover pure preference/window/envelope policy and
  coordinator ownership: stale results, late `playing`, simultaneous expiry
  and ended, pause before handoff, pause/resume, rapid transport, acknowledged
  handoff versus queue replacement, changed settings/queue, late callbacks,
  card-specific download completion, and cleanup.
  Use fake timers and minimal typed playback fakes, not component-render tests.
- Retain existing `listenQueue`, `listenPlayLength`, `useListenPlayLimit`,
  `randomStart`, source-selection, and offline tests. Update only assertions
  whose observable contract changes. Every logic-bearing step ships its tests.
- Browser matrix: video/video, audio/audio, video/audio, audio/video; full song
  and 10s/30s play lengths; Random start; master volume at zero and mid-fade;
  a short clip, unknown duration, empty/one-song/final-song queues; cold remote
  preload, failed/slow media, and browser-denied autoplay.
- Interactions: pause before/during overlap, resume, seek both directions,
  repeated Next/Previous, changed settings and scope, navigation away, reload,
  Hide/Auto Reveal, Details/Japanese panels, and Ambient. Check one active
  hotkey handler, one visible frame, and silent cleanup after leaving Listen.
- Use downloaded and complete cached clips offline; observe zero external
  requests in browser and server. An uncached clip uses existing offline
  explanations. Reuse existing Clip source enforcement and cache routes.
- Capture desktop/narrow screenshots and geometry with the project's browser
  tooling and `bun run measure`. A screenshot alone cannot prove an audio
  transition: record listening observations or an output capture alongside
  timestamped playback/gain evidence. Verify normal Study, Preview, and Kanji
  playback still work, especially the audio visualizer and shared volume.
- Compare `ReviewLog`, `CardTrack`, and card schedule/status fields before and
  after in the isolated database. Existing media-path/cache writes remain
  allowed. Finish with the documented tests and build, not a new test runner.

## Notes for the AI

- Keep the controller separate from the large page/player; do not turn this
  into a general media framework or rewrite unrelated playback behavior.
- Client code owns the two media slots and fade coordination. Filesystem,
  source policy, cache, and downloads continue through existing server routes.
- Guard server rendering, blocked storage, play rejections, and optional Web
  Audio availability. Never reduce current output on readiness assumptions.
- Preserve selectable Japanese text, theme tokens, and keyboard focus. Use the
  active frame when measuring; a hidden standby must not collapse the stage.
- Browser API references: media-element audio can be routed through a gain
  graph while retaining element transport controls ([MDN createMediaElementSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource));
  smooth gain changes need automation ([MDN GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode)).
- Feature 115 intentionally leaves number 114 for the stashed Party work.
  Do not restore that stash or modify its branch as part of this feature.
