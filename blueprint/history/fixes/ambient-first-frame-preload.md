# Fix: Ambient glow preloads the first frame instead of showing a blank background

**Type:** Fix
**Status:** verified

## The problem

`StudyMediaPlayer.vue`'s ambient glow (feature 14/24) only draws a frame
onto its canvas in response to specific events:

- `onPlay` → `startAmbientLoop()` (starts drawing every 150ms while
  playing).
- `onPause` → `stopAmbientLoop()` (one final draw, then stops).
- `onSeeked` → one draw (fires when `Start at random times`, or the
  webm `Infinity`-duration workaround, performs a seek).

None of these fire just from a card loading. In the common case -
`randomStart` off, a normal finite-duration clip - `onLoadedMetadata`
returns immediately after setting `duration.value` without seeking, so
no `seeked` event ever fires. The result: whenever a card is freshly
presented and the user hasn't hit play yet (true for every single card
at the start of a session, and every card change in between, since
`StudyMediaPlayer` remounts fresh via `:key="presentationKey"`), the
ambient canvas is blank, and the plain page background shows through
instead of a preview of the clip - even though Ambient mode is on.

## The fix

Add a `loadeddata` handler on the `<video>` element that attempts to draw
the ambient frame as soon as the browser reports the first frame is
decoded - independent of whether playback or a seek has happened yet.

**This needed more than "just draw on loadeddata," discovered by testing
it, not by reasoning about it.** The original plan was a single draw at
`loadeddata` (`readyState` reaching `HAVE_CURRENT_DATA`, the same
threshold `drawAmbientFrame()` already checks). Real browser testing
(Playwright, checking the canvas's actual pixel alpha channel, not just
assuming success) showed that threshold isn't sufficient by itself:
`drawImage` can still read back **fully transparent** immediately at that
event - confirmed by instrumenting `drawImage` itself, which showed the
call happening (readyState 4, valid video dimensions) yet producing zero
opaque pixels. A single `requestAnimationFrame` after the event wasn't a
reliable enough margin either - across repeated runs, the real
paintable-frame moment landed anywhere from 0 to 3 short retries later,
not a fixed delay. The fix instead **verifies its own output**: draw,
inspect the resulting pixels for any non-zero alpha (proof a real frame
landed, not just that the browser said `readyState` was high enough), and
retry after a short delay (150ms, up to 4 times) if not.

If `randomStart` is also on, this draws the frame at time 0 first, then
`onSeeked` (already wired) redraws with the actual random-time frame
once that seek completes shortly after - a brief, harmless first-frame
flash before the real target frame, strictly better than a blank
background in the meantime.

**Must not affect:** audio-only cards or Hide Video - the new handler
gates on `ambientActive.value` explicitly (matching `onSeeked`'s existing
pattern), so it never touches the canvas/video refs when ambient mode
isn't actually showing a video quiz card. Confirmed by testing: Hide
Video still renders no ambient canvas at all, and `randomStart` still
lands on its actual target frame with no stuck-on-frame-0 state and no
console errors.

## Build steps

- [x] **Step 1 - Draw the first frame on `loadeddata`, verifying it
  actually landed**
  - `nuxt-app/app/components/study/StudyMediaPlayer.vue`: added
    `onLoadedData()` (calls `retryAmbientPreload(4)`) bound to
    `@loadeddata` on the `<video>` element only (not `<audio>` -
    `ambientActive` already gates on `quizType.value === "video"`). Added
    `retryAmbientPreload(retriesLeft)`: draws via the existing
    `drawAmbientFrame()`, then reads the canvas's own pixel data back to
    check for any non-zero alpha; if still fully blank and retries
    remain, tries again after 150ms.

  *Done when:* with Ambient mode on, loading a fresh video card (without
  pressing play) shows the ambient glow colored from that clip's first
  frame, not the plain background - confirmed via Playwright reading the
  canvas's actual alpha channel (not just visual inspection), 100%
  success across 5 repeated runs, each landing within 1-3 retries.

## Verify

- No test runner configured; UI/canvas timing fix, no shared logic
  worth a unit test - rides on browser evidence instead, which this
  fix's own debugging already produced in depth (see below).
- Real Playwright verification performed (ad hoc, not a project
  dependency):
  - 5 repeated runs confirming the ambient canvas reaches non-zero alpha
    (a real frame drawn) before any play event, with the video
    confirmed still `paused`.
  - `drawImage` call instrumentation that caught the actual root cause
    (a call at valid `readyState`/dimensions still producing zero opaque
    pixels), which a plain "did the build pass" check would have missed
    entirely - the first implementation attempt looked correct by
    inspection and still didn't work.
  - Hide Video confirmed to still render no ambient canvas at all.
  - `Start at random times` confirmed to still land on its real target
    frame (no stuck-on-frame-0 state), with the preload's frame-0 flash
    as a harmless interim state.
  - No console or page errors in any of the above.
- `bun run build` clean.
