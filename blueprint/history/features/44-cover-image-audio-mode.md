# Feature: Cover image for audio-mode cards, with a Hide Cover toggle

**From build-plan:** feature 44
**Status:** verified

## Goal

Today, whenever `StudyMediaPlayer`'s audio veil shows (a naturally
audio-only card, or a card forced there by feature 43's Audio Only
setting), the player just shows a plain gradient background behind the
"Listening.../Paused" text. This feature shows the anime's cover image
there instead, and makes the ambient glow sample its colors from that
image rather than turning off entirely - a more visually engaging
audio-mode experience, with a session-only "Hide Cover" toggle (matching
Hide Video/Hide Info/Random Start/Ambient mode) for anyone who prefers the
plain look.

## In scope

- A new `hideCover` prop on `StudyMediaPlayer.vue`, plus a `showCoverArt`
  computed: true when `mediaKind === "audio"` (no real `<video>` element is mounted
  this session at all - true for a naturally audio-only card, or one
  forced there by the Audio Only setting; `mediaKind`, unlike `quizType`,
  is by design never affected by `hideVideo`, which is exactly what makes
  this the correct check rather than `quizType`), the card's anime has a
  cover image, that image hasn't failed to load, and `hideCover` is off.
- Displaying that cover image (`card.animeCoverImageUrl`) filling the
  player frame behind the existing veil whenever `showCoverArt` is true,
  with the veil's audio-mode background becoming a translucent dark tint
  over it (instead of today's opaque gradient) so the "Listening.../Paused"
  text and equalizer icon stay legible.
- The ambient glow (feature 14) sampling colors from that same `<img>`
  element (via canvas, same technique already used for video frames)
  whenever `showCoverArt` is true, instead of switching off.
- A new "Hide Cover" toggle on `/study`'s existing display-toggles row
  (`StudyDisplayToggles.vue`), session-only like its siblings (resets every
  session, defaults to off - cover shown), with hotkey `C`.
- Applies to `/study` only for the toggle UI. `CardPreviewModal` (Preview)
  reuses the same `StudyMediaPlayer` component and shows the cover image
  automatically under the same conditions (it already passes `audio-only`
  through from feature 43) - confirmed desired behavior. Preview has no
  toggle row at all, so there's no way to hide it there; no `CardPreviewModal`
  changes are needed for this to work.

## Out of scope

- The Hide Video toggle. A video-capable card with Hide Video on keeps
  today's exact plain veil - no cover image, no change to `quizType`'s
  existing `hideVideo` branch. This is deliberate: real video is still
  playing underneath for its audio track in that case, unlike a genuinely
  audio-only or Audio-Only-mode card where no video ever exists to look at.
- A dedicated "Hide Cover" toggle inside Preview - it gets the automatic
  behavior only (confirmed desired), no new UI there.
- Any change to `animeCoverImageUrl` itself (fetching, caching, or feature
  12's existing `/cards`/`/decks` thumbnail display) - this only *consumes*
  the field `StudyMediaPlayer` didn't have typed before now.
- Dynamically disabling the "Hide Cover" button based on whether the
  current card would actually show cover art - matches how Hide
  Video/Hide Info/Random Start/Ambient mode are already always clickable
  regardless of the current card, for the same simplicity.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Cover image display + Hide Cover toggle** - add
  `animeCoverImageUrl: string | null` to `useStudySession.ts`'s
  `CardWithDetails` interface (the server already returns this field via
  `GET /api/study/next`; only the client type was missing it). Add
  `"animeCoverImageUrl"` to `StudyMediaPlayer.vue`'s `card` prop `Pick`
  type. Add a `hideCover?: boolean` prop and the `showCoverArt` computed
  described above, plus a `coverImageFailed` ref reset to `false` whenever
  the card's `animeCoverImageUrl` changes and set `true` on the new
  `<img>`'s `@error` (so a broken/unreachable cover URL falls back to
  today's plain veil instead of a broken-image icon - the same
  degrade-gracefully convention feature 12's own cover thumbnails already
  follow elsewhere). In the template, render an `<img
  :src="card.animeCoverImageUrl">` (absolutely positioned, `object-fit:
  cover`, filling `.player-frame`) right before the veil block when
  `showCoverArt` is true, and add a `has-cover` modifier class to
  `.audio-veil` that swaps its background for a translucent dark tint. Add
  a "Hide Cover" button to
  `StudyDisplayToggles.vue` (new `hideCover`/`toggle-hide-cover`
  prop/emit, mirroring "Hide Video" exactly) and wire it into
  `study/index.vue`: a new session-only `hideCover` ref, a `c` hotkey
  alongside the existing `i`/`v`/`a`/`h`/`e` handlers, passed into both
  `StudyDisplayToggles` and `StudyMediaPlayer`. *Done when:* on `/study`, a
  naturally audio-only card (or any card with Audio Only mode on) shows its
  anime's cover image filling the frame with the veil legible on top;
  clicking "Hide Cover" (or pressing `C`) reverts to today's plain
  gradient veil and back; a card whose anime has no cover image is
  unaffected by the toggle either way (always the plain veil); a
  video-capable card with Hide Video on shows today's exact plain veil,
  untouched by any of this.

- [x] **Step 2 - Ambient glow samples the cover image** - extend
  `ambientActive` to also be true when `showCoverArt` is true (currently
  `ambient && quizType === "video"` only). Extend `drawAmbientFrame()` to
  draw from the cover `<img>` ref (checking `img.complete &&
  img.naturalWidth > 0` before drawing, mirroring the existing video
  `readyState` guard) when `showCoverArt` is true, instead of the `<video>`
  element. Reuse the existing interval-based draw loop unchanged (redrawing
  a static image every 150ms is negligible cost and avoids a second
  code path). Also guard `retryAmbientPreload()`'s `getImageData` call with
  a try/catch: `animeCoverImageUrl` points directly at AniList's CDN
  (unlike video/audio, never proxied through our own server), so drawing it
  is this canvas's first-ever cross-origin draw. In `CardPreviewModal`
  (which doesn't remount `StudyMediaPlayer` per card, unlike `/study`), the
  same canvas element can persist from an earlier cover-art card into a
  later video card, and a cross-origin draw taints a canvas for its whole
  lifetime - any later `getImageData` throws a `SecurityError`. Catching it
  and returning is harmless, matching this function's own existing
  "harmless if it never succeeds" philosophy. *Done when:* with Ambient
  mode and Audio Only both on, a playing card shows a background glow
  colored from its cover image instead of no glow at all; toggling "Hide
  Cover" on turns the glow off along with the in-frame image; toggling
  Ambient mode off/on behaves exactly as it does for video today; in
  Preview, switching from an audio-only card to a video-capable card (both
  with ambient on) doesn't throw or break the video ambient glow.

- [ ] **Step 3 - Spinning record disk instead of a full-frame image** -
  requested after Step 1/2 landed: the full-frame `object-fit: cover` image
  reads as "stretched to fill everything" rather than a deliberate visual
  choice. Replace it with a vinyl-record treatment: a dark circular disk
  (~45% of the frame's width, centered, subtle groove texture via a
  repeating radial gradient, a small center "spindle hole") with the cover
  image as a smaller circular "label" inset within it. The whole disk
  rotates continuously (`animation: spin <a few seconds> linear infinite`)
  while the card is playing, and stops - holding its current angle, not
  resetting to 0deg - when paused, via `animation-play-state` bound to
  `isPlaying` rather than a class swap. Keep the Step 1
  `.audio-veil.has-cover` override - it's load-bearing, not just a nicety:
  the veil's default background is fully opaque (its last background layer
  is a solid color) and always renders on top of the record in paint
  order, so without an override the record would be completely hidden, not
  merely low-contrast. Change what the override does, though: to
  `background: transparent` instead of a dark tint, revealing
  `.player-frame`'s own gradient background instead - the same look
  today's cover-less audio veil already uses, with the record and text now
  floating on top of it. The `<img>` keeps
  the same `ref="coverImageRef"` so Step 2's ambient sampling needs no
  changes at all - canvas `drawImage()` reads the image's raw bitmap, not
  its CSS transform/clip/border-radius, so restyling it as a small rotating
  circle has zero effect on what ambient samples. Also hide the existing
  "Listening.../Paused" text and eq-bars icon whenever `showCoverArt` is
  true - the disk's own spin/stop already communicates play state, so the
  text is redundant clutter over it; that text still shows normally once
  there's no cover to look at (Hide Cover on, or no cover image). *Done
  when:* a card showing cover art now shows a small spinning vinyl disk
  instead of a full-frame image, with no "Listening.../Paused" text or
  eq-bars overlaid on it; pressing pause stops the spin in place (not a
  jump back to a fixed rotation) and pressing play resumes it smoothly from
  there; toggling Hide Cover brings back today's plain veil with its text;
  ambient mode still shows a background glow colored from the same cover
  image, unchanged from Step 2's behavior.

## Files / areas

- `app/composables/useStudySession.ts` - add the missing
  `animeCoverImageUrl` field to the client-side `CardWithDetails` type.
- `app/components/study/StudyMediaPlayer.vue` - new prop, `showCoverArt`
  computed, cover `<img>` in the template, veil background change,
  `ambientActive`/`drawAmbientFrame` updates.
- `app/components/study/StudyDisplayToggles.vue` - new "Hide Cover"
  button/prop/emit.
- `app/pages/study/index.vue` - new `hideCover` ref, `c` hotkey, prop
  wiring to both child components.

## Data / contracts

- No schema or API changes - `animeCoverImageUrl` is already returned by
  `GET /api/study/next`; this only fixes a client-side type gap and adds a
  new consumer.
- New prop `hideCover?: boolean` on `StudyMediaPlayer.vue`, defaulting to
  falsy (cover shown) when not passed - this is why Preview shows it
  automatically unless Step 1 is told to pass `true` there instead (see
  In scope).

## Testing

No test runner is configured for this project yet (no `test` command in
`AGENTS.md`), so this rides on manual/browser evidence, not unit tests:

- Verify both steps' done-whens above directly in the running app.
- Confirm a card with no cover image (`animeCoverImageUrl: null`) is
  completely unaffected - today's plain veil, no ambient change, "Hide
  Cover" has nothing to do.
- Confirm a card whose cover image URL fails to load (temporarily point a
  test card at a broken URL) falls back to the plain veil instead of
  showing a broken-image icon.
- Confirm a video-capable card with Hide Video toggled shows today's exact
  behavior, with and without Audio Only mode set - Hide Video always wins
  the "keep the plain veil" case per the Out-of-scope note.
- Run the project's build (`bun run build`) as the final check.

## Notes for the AI

- `showCoverArt` must check `mediaKind`, not `quizType` - checking
  `quizType === "audio"` (optionally combined with `!hideVideo`) was the
  original draft and is subtly wrong: it makes Hide Video incorrectly
  suppress the cover art even on a naturally audio-only card that never
  had video to hide. `mediaKind` is unaffected by `hideVideo` by design, so
  `mediaKind.value === "audio"` alone is both simpler and correct.
- Reuse the exact existing interval-based ambient loop
  (`startAmbientLoop`/`stopAmbientLoop`, triggered by the same
  `onPlay`/`onPause`/`watch(ambientActive)` hooks) rather than building a
  separate "draw once" path for the static image - simplicity over a
  micro-optimization that doesn't matter at this app's scale (a 40x22
  canvas redrawn every 150ms).
- Match `StudyDisplayToggles.vue`'s existing button markup/props pattern
  exactly for "Hide Cover" (same `.toggle-btn`/`.tooltip` classes, same
  `:class="{ on: ... }"` binding) - this is one more sibling toggle, not a
  new visual treatment.
- The cover `<img>` needs to sit behind the veil but above the
  video/audio media elements in paint order - place it in the template
  between the media elements and the veil block so default DOM stacking
  order (no new z-index needed) already gets this right.
