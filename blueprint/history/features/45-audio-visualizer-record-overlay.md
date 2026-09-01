# Feature: Audio visualizer overlay on the spinning record

**From build-plan:** feature 45
**Status:** verified

## Goal

When a card's cover art/spinning record is showing (feature 44), overlay a
soft, glowing ring around the record that reacts to the actual playing audio
in real time, using the Web Audio API - giving the record the same "this is
actually playing" feedback the plain audio veil already gets from its
eq-bars icon, which is hidden in cover-art mode. Revised through review from
the original "bars painted in the accent color" concept to a smooth closed
loop filled with a heavily blurred stamp of the cover art itself, plus a
mouse-driven 3D parallax tilt on the record - see Step 2/3 below for what
actually shipped versus the original plan.

## In scope

- `AudioContext` + `AnalyserNode` + `MediaElementAudioSourceNode` wired to
  the existing `audioRef`, reconnected to `audioContext.destination` so
  playback stays audible.
- Created lazily, guarded so `createMediaElementSource` is never called
  twice on the same `<audio>` element (matters in `CardPreviewModal`, which
  can reuse one element across a card change without remounting
  `StudyMediaPlayer`, unlike `/study`).
- A canvas-based smooth closed loop just outside `.record-disk`'s edge,
  driven by `getByteFrequencyData()` via `requestAnimationFrame`, filled
  with a heavily blurred composite of the cover art (not a flat accent
  color) so it reads as "glowing with the cover's color" without showing
  recognizable image detail.
- Shown exactly when `showCoverArt && isPlaying`; stops and clears the
  instant playback pauses or `showCoverArt` goes false.
- Fully contained inside `.player-frame` (the 16:9 box) at every size,
  including expanded/immersive mode, using the same `cqw` sizing
  convention already used there.
- Applies wherever `showCoverArt` already applies: `/study` and
  `CardPreviewModal`, automatically - no new toggle.
- A mouse-driven 3D parallax effect on the record itself (tilt) and the
  visualizer ring (a smaller counter-shift), added after the visualizer
  shipped - see Step 3.

## Out of scope

- No dedicated on/off toggle - tied to `showCoverArt`/Hide Cover exactly
  like the record itself.
- Video-mode cards - the visualizer is an audio-only-card concern.
- The ambient glow's own canvas/sampling - untouched, separate canvas.
- No cover image, or a cover image that fails to load - falls back to
  today's plain audio-veil path unchanged, no visualizer.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Web Audio plumbing + basic visualizer** - wire an
  `AudioContext`/`AnalyserNode`/`MediaElementAudioSourceNode` graph from
  `audioRef` to `audioContext.destination`, guarded so the source node is
  only ever created once per underlying `<audio>` element instance (via
  `watch(audioRef, ...)`, which only fires on a genuine element
  create/destroy, not a same-element `src` change); resume the
  (autoplay-suspended) `AudioContext` inside `togglePlay()`'s existing click
  handler, a real user gesture. Added a `visualizerCanvasRef` canvas inside
  `.player-frame` and a `requestAnimationFrame` loop (started/stopped
  alongside the existing `onPlay`/`onPause` handlers, mirroring
  `startAmbientLoop`/`stopAmbientLoop`'s lifecycle) reading
  `analyser.getByteFrequencyData()` each frame - shipped as a placeholder
  linear bar row initially; superseded by Step 2's shape/fill, but the
  plumbing here (graph lifecycle, autoplay resume, rAF start/stop) is
  unchanged. *Done when:* playing a naturally audio-only card (or one
  forced there by Audio Only mode) that has cover art shows visible motion
  reacting in real time to the actual sound; pausing stops it; the audio
  itself is still audible; opening the same card again, or a different
  audio-only card, in `/study` or Preview never throws a
  `createMediaElementSource`-related console error. Verified via `bun run
  build` only (no browser available this session); confirmed working by the
  user via screenshot during Step 2.
- [x] **Step 2 - Ring shape, cover-derived fill, cleanup** - revised twice
  through review from the original "radial bars in a flat accent color"
  plan. Final shape: `smoothedAmplitudes()` runs a circular moving average
  over the raw frequency data (real audio energy concentrates in a few low
  bins, so per-bin bars left most of a 64-bar ring at true zero - looked
  like a broken arc, not a ring), producing one smooth closed loop via
  `quadraticCurveTo` through per-point midpoints, resting at
  `VISUALIZER_BASE_RADIUS` (just outside `.record-disk`'s edge) and bulging
  outward up to `VISUALIZER_MAX_DEFORM` with the (smoothed) signal - stays a
  near-circle at rest, deforms gently with real playback. Final fill: the
  loop is stroked as an opaque mask, then `globalCompositeOperation =
  "source-in"` stamps the actual `coverImageRef` image into it (real cover
  pixels, not a derived/sampled average - sampling was tried and dropped:
  it needed a second CORS-mode image load with no guarantee AniList's CDN
  grants it), immediately followed by a heavy CSS blur
  (`clamp(8px, 1.4cqw, 26px)` on `.visualizer-canvas`) so the result reads
  as a colored glow, not a recognizable crop of the art - drawing/compositing
  onto a canvas is always allowed regardless of CORS, only *reading* pixels
  back out (`getImageData`) is restricted, so this path can't fail the way
  color-sampling could. Falls back to a flat purple stroke if the cover
  hasn't decoded yet. Stops the rAF loop and clears the canvas the instant
  `showCoverArt` goes false (Hide Cover, cover-image failure, or `mediaKind`
  flip to video) or playback pauses. Closes/disconnects the audio graph
  `onUnmounted` and whenever the underlying `<audio>` element is replaced
  (mediaKind toggling in Preview). *Done when:* the visualizer reads as a
  continuous glowing ring around the spinning record wrapping fully around
  it, colored like the cover without showing recognizable image detail,
  stays inside the player frame at every size including expanded mode,
  disappears cleanly on pause/Hide Cover/no-cover-image, and cycling
  through several audio-only and video-capable cards in one Preview sitting
  never throws a console error or leaves multiple visualizers/audio graphs
  running. Verified via `bun run build` plus the user's own screenshots
  through three rounds of visual iteration (initial linear-bar placeholder,
  a radial-bar sketch, then the final smooth loop) - not independently
  verified in a live browser by the AI, since no Playwright/browser tooling
  was available this session.
- [x] **Step 3 - 3D parallax on the record** - added after the visualizer
  itself was approved, as a follow-on enhancement rather than a
  pre-planned step. `@mousemove`/`@mouseleave` on `.player-frame` drive two
  depth layers: `.record` (disk + label + spindle hole) tilts up to ±10°
  via `perspective(700px) rotateX()/rotateY()` following the cursor,
  applied to the wrapper div rather than `.record-disk` itself since the
  disk's own `record-spin` keyframe animation targets `transform` and would
  silently override a same-element inline transform; the visualizer ring
  canvas counter-shifts a smaller `±6px` via `translate()`, the classic
  "farther layer moves less and opposite" parallax cue. Both ease back to
  neutral over 0.2s on mouse-leave. Gated on `showCoverArt` (no physical
  disk to tilt in video mode), with a `watch(showCoverArt)` reset so
  returning to a cover-art card without an intervening mousemove doesn't
  show a stale tilt. *Done when:* moving the mouse over a cover-art card's
  player tilts the disk toward the cursor and the ring drifts slightly the
  other way, both easing back to flat on mouse-leave; a video-capable card
  is completely unaffected. Verified via `bun run build` only - not
  confirmed in a live browser by the AI.

## Files / areas

- `app/components/study/StudyMediaPlayer.vue` - new refs
  (`audioContextRef`/`analyserRef`/`visualizerCanvasRef`), Web Audio
  setup/teardown, the rAF draw loop, new template markup + scoped styles
  for the ring. No other files change.

## Data / contracts

- None - purely client-side, no schema or API changes.

## Testing

No test runner is configured for this project yet (no `test` command in
`AGENTS.md`), so this rides on manual/browser evidence:

- All three steps' done-whens verified via `bun run build` (typecheck +
  client/server build, no errors) after every change, plus the user's own
  screenshots/manual checks in the running app across the review rounds -
  the AI had no browser/Playwright tooling available this session, so
  nothing here was independently confirmed rendering correctly by the AI
  itself.
- Cover: a naturally audio-only card, a video-capable card forced to audio
  via Audio Only mode, a card with no cover image (must be completely
  unaffected - no visualizer, no error, no parallax), and a card whose
  cover image URL fails to load.
- Confirm a video-capable card (no Audio Only, no forced audio) never shows
  a visualizer or tilts.
- Run `bun run build` as the final check (no `Verify` command is configured
  in `AGENTS.md` yet).

## Notes for the AI

- `createMediaElementSource` throws if called twice on the same `<audio>`
  element - guard explicitly by element identity, not just `onMounted`,
  since Preview's element can outlive multiple `card` prop changes while
  `mediaKind` stays "audio".
- Autoplay policy: `AudioContext` starts `"suspended"` until resumed inside
  a user gesture - resume it inside `togglePlay()`, not in a `watch` or
  `onMounted`.
- Reconnect the source node to `audioContext.destination` - without it,
  wiring an analyser silently mutes playback, since `createMediaElementSource`
  takes over the element's audio output routing.
- Same-origin note: both local (`/api/media`) and remote
  (`/api/media/stream`) audio URLs are proxied through this app's own
  server (feature 41), so there's no cross-origin tainting concern for Web
  Audio here (unlike the cover-image canvas draw, which needs a try/catch
  workaround) - no `crossOrigin` attribute or extra guarding needed on the
  `<audio>` element itself.
- Use a separate canvas from `ambientCanvasRef` - that one is single-purpose
  (teleported off-DOM, blurred background glow); this visualizer lives
  inside `.player-frame` and draws its own composited/blurred loop.
- Canvas drawing/compositing (`drawImage`, `globalCompositeOperation`) is
  always allowed regardless of CORS; only reading pixels back out
  (`getImageData`/`toDataURL`) is restricted. The final design leans on that
  distinction deliberately (Step 2) instead of the CORS-dependent
  color-sampling approach tried and reverted mid-build.
- A CSS `animation` on an element's `transform` overrides a same-element
  inline `transform` for as long as the animation runs - this is why the
  parallax tilt (Step 3) had to go on `.record` (the wrapper) rather than
  `.record-disk` (which owns the `record-spin` keyframe animation).
