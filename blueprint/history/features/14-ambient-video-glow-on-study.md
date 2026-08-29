# Feature: Ambient video glow on Study

**From build-plan:** feature 14
**Status:** verified

## Goal

Give the `/study` video player a soft, blurred, color-sampled glow behind it
that shifts with the video - YouTube Ambient Mode, applied only to the study
screen.

**Design call for review (from the plan-approval step):** the glow is driven
by a small hidden `<canvas>` that periodically draws the *same* `<video>`
element already playing (`ctx.drawImage(videoEl, ...)`), rendered large and
heavily CSS-blurred - not a second `<video>` element playing a duplicate
stream. This reuses the one decode already happening for playback instead of
doubling the network/decode cost of every remote animethemes.moe clip.

## In scope

- `StudyMediaPlayer.vue` gains an `ambient?: boolean` prop (default `false`,
  so every existing usage is unaffected unless it opts in).
- When `ambient` is true and `quizType === 'video'` (a real video frame is
  showing - not audio-only, not Hide Video), a hidden low-resolution
  (40x22) `<canvas>` redraws the current video frame: on `play` (starts a
  ~150ms `setInterval`), once on `pause` (captures the exact paused frame,
  then stops the interval - no polling while paused), and once on `seeked`
  (keeps the glow roughly in sync after a scrub-bar click or the random-start
  jump). The canvas is displayed large via CSS (`width`/`height` far
  exceeding its 40x22 pixel buffer) with a heavy `blur`/`saturate` filter,
  positioned behind and extending beyond `.player-card`'s edges via a new
  `position: relative` wrapper around the existing card.
- `/study`'s page passes `:ambient="true"` to `<StudyMediaPlayer>` - the only
  usage that does. This is the single step that actually makes the effect
  visible anywhere in the app.
- No glow when `quizType !== 'video'` (audio-only, or Hide Video active) -
  there's no real frame to sample, and for Hide Video specifically, a glow
  driven by the hidden frame would leak exactly the visual information that
  toggle exists to suppress.

## Out of scope

- `CardPreviewModal` - reuses the same `StudyMediaPlayer` component but
  never passes `ambient`, so it stays exactly as it is today. Matches the
  "study page only" scope from the plan-approval step.
- A toggle to turn the glow on/off per session (unlike Hide Video/Hide
  Info/Start at random times from feature 10) - it ships as the default
  treatment whenever a video is showing. A toggle is a reasonable future ask
  but wasn't requested here, and adding one un-asked would be scope creep.
- `prefers-reduced-motion` handling - the glow updates slowly (~150ms color
  drift, not a flashing animation), so this isn't treated as motion-sensitive
  content. Revisit if that judgment turns out wrong.
- Aspect-ratio-correct sampling - `drawImage` stretches the source frame to
  the canvas's 40x22 buffer regardless of the video's real aspect ratio;
  imperceptible after this much blur, not worth the extra code.
- `crossOrigin="anonymous"` on the `<video>` element - deliberately not
  added. See Notes for the AI.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

This feature is one atomic step, not several: the canvas mechanism inside
`StudyMediaPlayer.vue` has no observable effect anywhere until `/study`
passes `ambient="true"`, so splitting "build the mechanism" from "wire it up"
would produce a first step with nothing to actually verify in the browser.
Both land together.

- [ ] **Step 1 - Canvas-sampled ambient glow** - in
  `app/components/study/StudyMediaPlayer.vue`: add the `ambient` prop; wrap
  the existing `<div class="player-card">` root in a new `position:
  relative` host div (unconditional - an extra non-box-model wrapper div has
  no visual effect on existing usages); add the `ambientCanvasRef` canvas
  (`v-if="ambient && quizType === 'video'"`, `width="40" height="22"`,
  `aria-hidden="true"`) as the host's first child, styled via CSS to sit
  behind `.player-card` (`z-index: 0` vs. `.player-card`'s new `z-index: 1`)
  and bleed past its edges (negative `inset`) with `filter: blur(...)
  saturate(...)`; add `drawAmbientFrame()` (guarded on `video.readyState >=
  2`) wired to `@play` (start the interval), `@pause` (one final draw, clear
  the interval), and `@seeked` (one draw) on the existing `<video>` element;
  clear the interval `onUnmounted`. In `app/pages/study/index.vue`, add
  `:ambient="true"` to the existing `<StudyMediaPlayer>` usage. *Done when:*
  in the browser, a video-backed card on `/study` shows a blurred, colorful
  glow behind the player that visibly shifts as the clip plays, holds its
  last color when paused, and updates promptly after a scrub-bar seek; an
  audio-only card or a video card with Hide Video active shows no glow;
  `CardPreviewModal` (which never passes `ambient`) is visually unchanged.
  `bun run build` must stay clean and the browser console must show no
  canvas/video errors.

## Files / areas

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - the glow mechanism.
- `nuxt-app/app/pages/study/index.vue` - one prop, enabling it.

## Data / contracts

No schema or API changes - this is entirely client-side rendering. The only
new "contract" is the prop itself:

```ts
// StudyMediaPlayer.vue props
ambient?: boolean; // default false
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test` entry),
and this feature is pure client-side rendering with no branching logic
worth unit-testing even if a runner existed - it rides entirely on browser
verification and `bun run build`.

**No browser tool is available in this session** (consistent with every UI
step this whole conversation), so I can't personally watch the glow render
or shift color. I'll verify what a build and SSR HTML can confirm (the new
elements/classes exist, no build errors, `CardPreviewModal`'s usage
structurally can't pass `ambient`) and then hand this to you or `/try` for
the actual visual call - this is exactly the kind of feature that most
needs real eyes on it.

## Notes for the AI

- Never add `crossOrigin="anonymous"` to the `<video>` element to "fix" a
  canvas taint concern - there isn't one here. The canvas is only ever
  *displayed* (via CSS on the element itself), never read back with
  `getImageData`/`toDataURL`, so a cross-origin-tainted canvas (from
  animethemes.moe's remote clips) renders and blurs completely normally.
  Adding `crossOrigin` would instead risk *breaking playback* if
  animethemes.moe's CDN doesn't send proper CORS headers - a real
  regression for an imaginary problem.
- Client-only: no server route or DB change of any kind.
- The `player-ambient-host` wrapper must not introduce its own padding,
  margin, or size constraints - it exists purely as a `position: relative`
  anchor for the absolutely-positioned glow layer, so every other visual
  aspect of the player stays pixel-identical when `ambient` is false or
  `quizType !== 'video'`.
- Reuse the existing `videoRef`/`quizType`/`onLoadedMetadata` machinery
  already in this component - don't introduce a second video element or a
  parallel state-tracking system for play/pause/seek.
