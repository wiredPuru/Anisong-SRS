# Feature: Mix fade length

**From build-plan:** feature 116a (sub-feature of 116, Mix fade length and curve)
**Status:** complete

## Goal

Let the user choose how long Listen's Mix crossfade lasts: 2, 5, 8 or 12
seconds, remembered in the browser, default 5 so nothing changes until it is
touched. Feature 115 hardcoded five seconds.

## Design reference

Extend the Display menu in `nuxt-app/app/pages/listen/index.vue`, directly under
the Mix toggle, reusing the existing `menu-select` styling the Play length
select already uses. No new visual target; there is no root `prototypes/`
directory.

## In scope

- A Fade length select with 2, 5, 8 and 12 second options, default 5, saved in
  `localStorage` and read only on the client.
- The overlap planner, the handoff window and the "Next in" countdown all use
  the chosen length instead of the fixed five seconds.
- Short songs keep today's rules: the overlap is the smallest of the chosen
  length, half the outgoing segment and half the incoming segment, and a result
  under one second means ordinary advancement.
- The control is shown only while Mix is on, and disabled with a visible reason
  while Autoplay is off, like the Play length select.

## Out of scope

- The Smooth/Linear curve (feature 116b) and any gain-helper change.
- Arbitrary lengths, a slider, per-song lengths, or a length for manual Next.
- Changes to the slot coordinator's handoff, pause, seek or cleanup rules.
- Other pages (Study, Preview, Party, Kanji) and any server, schema, route or
  dependency change.

## Build loop

Outline and implement one small step, show its diff and evidence, then wait for
review. Each logic-bearing step ships its adjacent tests. Checkpoints need
approval and passing tests and build. `/complete` owns the archive and merge.

## Build steps

- [x] **Step 1 - Length policy and preference.** Add the option list, default,
  strict stored-value parser, and a `targetSeconds` input to `planListenMix`
  (default unchanged); extend `useListenMix` with a persisted length that works
  session-only when storage is blocked.
  *Done when:* tests cover missing, malformed and out-of-list storage (all give
  5), each option accepted exactly, 12s capped by short outgoing or incoming
  songs (a 20s song caps 12 to 10), 2s kept for long songs, and the one-second
  floor still falling back to ordinary advancement. `bun run test` and
  `bun run build` pass. No visible change yet.

- [x] **Step 2 - Use it in playback.** Add the length to the coordinator's
  settings, replace its fixed window with it, and make the page's "Next in"
  subtract the chosen length.
  *Done when:* fake-clock coordinator tests show a 2s setting starting the
  overlap at 2s left and ramping `(1, 2)` and `(0, 2)`, a 12s setting starting
  at 12s left, a length change mid-song re-staging the standby, and the
  countdown arithmetic covered by a small pure helper's test. Existing Mix
  tests still pass.

- [x] **Step 3 - Menu control and proof.** Add the select under Mix with an
  accessible label, shown while Mix is on and disabled with the existing
  "Needs Autoplay on" wording while Autoplay is off.
  *Done when:* in the browser against an isolated data directory, 2s and 12s
  settings produce overlaps of those lengths (gains sampled from the real audio
  nodes, complementary and ending at 0/1), reload restores the choice, Mix off
  hides it, and the narrow layout has no overflow. Screenshot captured.
  `bun run test` and `bun run build` pass.

Verified 2026-10-29: `bun run test` passes 2,652 tests and `bun run build`
passes. In headless Chromium against an isolated offline data directory with
generated 40s clips, a 2s setting (10s play length) overlapped 2s with the
shared graph's gains going 0.95/0.05 to 0.16/0.84 to 0/1 and "Next in"
counting to the handoff; a 12s setting (30s play length) overlapped 12s with
gains 0.98/0.02 to 0.09/0.91 to 0/1. Reload restored 12s, Mix off hid the
select while keeping the saved value, and the narrow layout had no overflow
and one visible frame. Screenshot: `fade-menu.png` in the session scratchpad.
Not covered: 5s and 8s runs, Autoplay-off disabled state in the browser, other
browsers, and a human listening check.

## Files / areas

All paths are relative to `nuxt-app/`.

| Area | Purpose |
| --- | --- |
| `app/utils/listenMix.ts` and test | Options, default, parser, `targetSeconds`, countdown helper |
| `app/composables/useListenMix.ts` and test | Persisted length alongside the toggle |
| `app/composables/useListenPlayback.ts` and test | Chosen length in settings and the handoff window |
| `app/pages/listen/index.vue` | Select under Mix, countdown, passing the length |

## Data / contracts

- Storage key `gaqSrs:listenMixSeconds` holds the option as a plain integer
  string; anything not exactly `"2"`, `"5"`, `"8"` or `"12"` reads as 5.
- `ListenPlaybackSettings` gains `mixSeconds: number` (load-bearing: 116b will
  add its curve beside it). A change settles any running overlap, the same as
  changing Play length, and re-stages the standby.
- `LISTEN_MIX_SECONDS` (5) stays as the default and `MIN_LISTEN_MIX_SECONDS` (1)
  stays the floor.
- The countdown subtracts the overlap actually planned, which can be shorter
  than the chosen length for a short song; the helper takes the same segment
  inputs as the planner.

## Testing

Pure logic (parser, planner, countdown helper) gets Vitest cases next to the
source. Coordinator timing gets fake-clock tests in
`useListenPlayback.test.ts`. The menu control rides on browser evidence and the
build, per the testing gate in `coding-standards.md`.

## Notes for the AI

- Keep it small: this is a parameter threaded through existing code, not a
  rework of the coordinator.
- Changing the length mid-overlap settles the overlap on purpose, matching the
  Play length rule; do not add special handling.
- Reuse the Play length select's markup and classes; no inline styles and no
  hard-coded colours.
- Do not touch `mediaGain.ts` or the ramp calls; that is 116b.
