# Current Feature

## Title

Auto-reveal countdown pill too small and off-center in expanded/immersive study mode; then made to replace the Listening indicator

## Type

Fix

## Status

Verified

## The problem

On `/study` (and Preview, which shares the same overlay via feature 36), once
expanded/immersive mode is on, the "Revealing in N" countdown pill
(`StudyAutoRevealCountdown.vue`) stays at its fixed, small non-immersive size
- it doesn't grow with the rest of the immersive overlay, so on a large
expanded video frame it reads as tiny relative to everything around it.

Root cause: `StudyAutoRevealCountdown.vue`'s styles
(`.auto-reveal-countdown`, `.label`, `.count`) are fixed px values with no
immersive-mode override:

```css
.auto-reveal-countdown {
  gap: 8px;
  padding: 10px 18px;
}
.label {
  font-size: 12px;
}
.count {
  font-size: 20px;
}
```

Every other element in the immersive overlay scales proportionally with the
video frame instead. `StudyMediaPlayer.vue`'s `.player-frame` sets
`container-type: inline-size`, and immersive-only sibling elements
(`StudyInfoPanel.vue`'s `.info-card.overlay` chips, `study/index.vue`'s
`.answer-slot :deep(.answer-btn)`, and `.player-card.expanded`'s own
`.expand-btn`/`.theme-badge`/`.play-btn`/`.scrub`/`.time`/`.volume-*`) all add
a `clamp(min, Ncqw, max)` override scoped to their immersive/expanded class,
calibrated so the `cqw` value matches today's fixed px at the same ~1450px
reference frame width every one of those overrides already uses. The
countdown is the one immersive overlay piece that never got this treatment.

## The fix

Add a `.auto-reveal-countdown.immersive-glass`-scoped override (mirroring the
exact pattern above) that clamp-scales padding, gap, and both font sizes
against `.player-frame`'s rendered width - so the pill grows with the frame in
expanded/immersive mode, and stays exactly as-is everywhere else (the
non-immersive side-panel countdown is untouched, matching how
`.info-card.overlay`'s own scaling is scoped only to `overlay`).

In `StudyAutoRevealCountdown.vue`, under a new `.auto-reveal-countdown.immersive-glass` rule
(plus scoped `.label`/`.count` selectors under it):

- `padding`: `clamp(16px, 1.5cqw, 36px) clamp(28px, 2.5cqw, 56px)` (from `10px 18px`)
- `gap`: `clamp(10px, 1cqw, 22px)` (from `8px`)
- `.label` `font-size`: `clamp(18px, 1.65cqw, 40px)` (from `12px`)
- `.count` `font-size`: `clamp(40px, 3.85cqw, 80px)` (from `20px`)

Revised from an initial pass that matched the smaller "meta chip" scaling
convention (e.g. `StudyInfoPanel.vue`'s `.label`) - that kept the floor at
roughly today's already-small size, so on a typical desktop window (frame
width well under the ~1450px reference other overlay chips are calibrated
against) it barely grew at all. The floor here is deliberately raised well
above the non-immersive size instead, since this is a primary callout the
user is waiting on, not secondary meta text - `cqw` growth on top of that
still kicks in once the frame gets wide enough (roughly >1000-1100px).

Must not break: the non-immersive countdown (unscoped, unaffected) or the
ambient-glass/immersive-glass visual treatment already in place.

### Follow-up: recenter on the video, not the info card's corner

After the sizing fix landed, user feedback on a real screenshot: the pill
"looks off to the side" in immersive mode. Root cause: the immersive
countdown is rendered *inside* `study/index.vue`'s `.info-slot` (a small box
anchored top:7.36%/left:1.1%, sized to wherever the info card sits), so it
centers on that corner box, not on the video itself - while the paused/audio
veil's own "Listening..." icon+text (or the record, when that's showing
instead) are centered on the whole `.player-frame`. That mismatch is what
reads as "off to the side."

Fix: move the immersive `<StudyAutoRevealCountdown>` instance in
`study/index.vue` out of `.info-slot` to be a direct sibling of `.info-slot`/
`.answer-slot` inside the immersive slot (making `.player-frame` its
positioned ancestor instead), then reposition it in
`StudyAutoRevealCountdown.vue`'s `.immersive-glass` rule to anchor just above
the frame's vertical center - so it sits right above the centered
"Listening..." indicator instead of overlapping it or sitting in the corner.
The offset is a fixed px value (not proportional) because the icon+text
stack it's clearing is itself fixed-size regardless of frame width.

**Second follow-up, same session:** user preferred it below the indicator
instead of above. Flipped the anchor to `top: calc(50% + 66px); left: 50%;
transform: translateX(-50%);` - same fixed offset magnitude, opposite side.

**Third follow-up, same session:** user asked to replace the "Listening..."
indicator with the countdown outright, dead-centered, rather than sitting
next to it in either direction. `StudyMediaPlayer.vue` gained a new
`hideListeningLabel` prop that suppresses its own `.listening-icon` and
`<p>Listening.../Paused</p>` (both already conditioned on `!showCoverArt`;
now also on `!hideListeningLabel`). `study/index.vue` factored the
already-duplicated auto-reveal-active condition into one
`autoRevealCountdownActive` computed (previously inlined identically at each
`<StudyAutoRevealCountdown v-if="...">` call site) and passes
`:hide-listening-label="immersive && autoRevealCountdownActive"` into
`<StudyMediaPlayer>`. With the veil's own label out of the way,
`StudyAutoRevealCountdown.vue`'s `.immersive-glass` rule no longer needs any
position override at all - the base rule's dead-center `top/left/transform`
already lands it exactly where that indicator was; only `z-index: 10` is
kept from the positioning override.

Must not break: the non-immersive countdown (still nested in
`.info-panel-wrap`, unaffected - the new prop is only ever passed `true`
while `immersive` is also true), the sizing fix above, non-immersive or
Preview veil behavior (the new prop defaults `false`/unset everywhere else,
so `CardPreviewModal` and non-immersive `/study` keep their existing
"Listening..."/"Paused" text), and the "Info"-only auto-reveal mode (no
veil/label showing there to begin with when real video is playing, so
nothing to suppress - unchanged).

## Build steps

1. [x] Edit `StudyAutoRevealCountdown.vue`: add the clamp-scaled
   `immersive-glass` override as described above.
   **Done when:** in expanded/immersive study mode with Auto Reveal active,
   the countdown pill visibly scales up with the video frame size (readable
   and proportionate on a large frame, not the same small fixed size as
   non-immersive), while the non-immersive countdown next to the side info
   panel looks unchanged.
2. [x] Move the immersive countdown out of `.info-slot` (`study/index.vue`).
   Iterated on where it lands relative to the video's "Listening..."
   indicator per user feedback, ending on: replace that indicator outright
   (`hideListeningLabel` prop on `StudyMediaPlayer.vue`, wired from a shared
   `autoRevealCountdownActive` computed in `study/index.vue`) and keep the
   countdown dead-centered in `StudyAutoRevealCountdown.vue`.
   **Done when:** in immersive mode with the countdown active, the
   "Listening..."/"Paused" icon+text is not shown - the countdown pill sits
   centered in its exact place instead; non-immersive positioning (and its
   own "Listening..." label) is unchanged, and Preview's veil label is
   unaffected.

## Verify

Manual, in the browser (`/study`, immersive mode `E`):

1. Set Auto Reveal to "Info" or "Both", a few seconds.
2. Play a card, press `E` for immersive mode, on a reasonably wide window.
3. Confirm the "Listening..." icon+text is not shown while the countdown is
   active - the "Revealing in N" pill sits dead-centered in that exact spot
   instead, noticeably larger/more proportionate to the expanded video than
   before.
4. Let it auto-reveal (or pause/resume mid-countdown) and confirm the video
   plays normally afterward with no leftover positioning issue.
5. Exit immersive mode and confirm the non-immersive countdown (next to the
   side info panel) still looks exactly as before, and that its own
   "Listening..."/"Paused" veil text is untouched.
6. Open a card in Preview (`/cards`) and confirm its veil's
   "Listening..."/"Paused" text still shows normally (Preview never sets
   Auto Reveal, so `hideListeningLabel` should never engage there).
