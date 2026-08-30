# Fix: Random start times always land on 0:00

**Type:** Fix
**Status:** verified

## The problem

Study's "Start at random times" toggle (feature 10) never actually randomizes
- every clip starts at 0:00, every time. Root cause in
`app/components/study/StudyMediaPlayer.vue`'s `randomStartTime()`:

```ts
function randomStartTime(resolvedDuration: number): number {
  return Math.random() * Math.max(resolvedDuration - 15, 0);
}
```

This is meant to pick a random point while never landing in the clip's last 15
seconds. But for any clip whose total duration is **15 seconds or shorter**,
`resolvedDuration - 15` clamps to `0`, collapsing the whole random range to a
single point: `Math.random() * 0` is always exactly `0`. That's deterministic,
not a race condition or a browser quirk - it reproduces on every single clip
at or under that length, which matches "always starts at 0:00" exactly. Short
clips are a normal thing to have in an AMQ practice library (cut down from the
full song specifically for quiz-length review), so this isn't an edge case -
it's the common case for anyone using short clips, and it silently defeats the
entire feature for them.

Both call sites (`onLoadedMetadata`'s normal path, and its `durationchange`
workaround for webm streams that report `Infinity` duration until scanned)
call this same shared function, so fixing it once covers both.

## The fix

When a clip is too short for the 15-second buffer to leave any real range,
randomize across the *whole* clip instead of collapsing to a single point -
keep the "avoid the last 15 seconds" behavior for clips long enough to have
one, but stop it from silently zeroing out the feature for short clips:

```ts
function randomStartTime(resolvedDuration: number): number {
  const safeRange = resolvedDuration - 15;
  return safeRange > 0 ? Math.random() * safeRange : Math.random() * resolvedDuration;
}
```

Must not break: the existing behavior for clips longer than 15 seconds
(random point, never in the last 15s) stays exactly the same - only the
short-clip fallback path changes.

## Build steps

- [x] **Step 1 - Fix `randomStartTime`'s short-clip fallback** - Update the
  function in `StudyMediaPlayer.vue` as above.
  *Done when:* for a clip longer than 15 seconds, repeated presentations
  still produce varied start times, never in the last 15 seconds (unchanged
  from today). For a clip 15 seconds or shorter, repeated presentations with
  the toggle on produce varied start times across the clip's full length,
  not always `0:00`.

## Verify

- `bun run build` clean.
- Manual: with a short local clip (under 15s) attached to a card, turn on
  "Start at random times" and study that card a few times (fail it
  immediately to resurface it, or revisit `/study`) - confirm the start
  point actually varies instead of always landing on `0:00`. Repeat with a
  longer clip and confirm it still avoids the last 15 seconds.
- No test runner configured in `AGENTS.md`; `randomStartTime` is a small pure
  function, so a focused unit test would normally be in scope once a runner
  exists (see the Testing gate in `coding-standards.md`) - for now this rides
  on manual/browser verification and build evidence, same as prior fixes in
  this area.

## Verification evidence

- `bun run build` - clean at the step and at the final safety pass.
- Ran the new formula standalone (`bun -e`) across durations 5/10/15/20/30/90
  seconds: clips at or under 15s now produce varied start points across their
  full length (previously always `0`); clips over 15s stay within
  `[0, duration-15)`, unchanged.
- Gap: not exercised in a live browser (no Playwright in this project) -
  verified via the formula's own math plus build evidence.

## Findings

None raised against this fix.
