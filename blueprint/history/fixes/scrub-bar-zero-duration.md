# Fix: Study/Preview scrub bar sometimes gets stuck showing "0:00" total duration

**Type:** Fix
**Status:** verified

## The problem

Reported with a screenshot: the player showed a progressing current time
(`0:13`) next to a total duration stuck at `0:00`, and the scrub bar itself
rendered as an unfilled flat line - it never recovered for the rest of that
card's playback.

Root cause, in `StudyMediaPlayer.vue`'s `onLoadedMetadata()`:

```ts
if (Number.isFinite(el.duration)) {
  duration.value = el.duration;
  ...
  return;
}
// else: registers a `durationchange` listener as a fallback, for the known
// case where el.duration is Infinity/NaN until the browser scans the stream
```

`Number.isFinite(0)` is `true`. Some streamed clips fire `loadedmetadata`
with `el.duration` transiently equal to exactly `0` before the real
duration becomes known via a later `durationchange` event - the same
browser quirk the existing comment already documented for Infinity/NaN,
just manifesting as `0` on some clips. Because `0` passes `Number.isFinite`,
the function took the "real duration" branch, permanently set
`duration.value = 0`, and returned - without registering the
`durationchange` fallback that would otherwise catch the real value.
`currentTime` kept updating normally via `timeupdate`, producing exactly
the reported symptom.

## The fix

Treat `0` the same as `Infinity`/`NaN`: not yet a real duration. Changed the
branch condition from `Number.isFinite(el.duration)` to
`Number.isFinite(el.duration) && el.duration > 0`, so a `0`-duration
`loadedmetadata` now falls into the same existing `durationchange` fallback
path that already works for the Infinity/NaN case.

The scrub-seek handler already guarded against a zero/non-finite duration,
so no change was needed there.

## Build steps

- [x] **Step 1 - Widen the duration-quirk guard to include zero** - changed
  the `onLoadedMetadata()` condition. *Done when:* a `loadedmetadata` firing
  with `el.duration === 0` registers the `durationchange` fallback instead
  of permanently freezing `duration.value` at `0`.

## Verify

- `bun run build` passes clean.
- Confirmed no regression on the normal (immediately-resolved) path via a
  live screenshot of `/study` - duration displayed correctly.
- This exact race is browser/network-timing-dependent and not reliably
  reproducible on demand in a scripted session; the original bug report
  screenshot is the reproduction evidence, and the fix directly closes the
  code path that produces that exact symptom.
