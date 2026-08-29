# Fix: Full-page ambient glow + toggle

**Type:** Fix
**Status:** verified

## The problem

Feature 14's ambient glow (just merged) doesn't look right in practice: it's a
small, heavily-blurred canvas bled only slightly past the player card's own
edges (a modest halo), not a glow across the whole page background the way
YouTube's Ambient Mode actually looks. It's also always-on whenever a video
card is showing, with no way to turn it off.

## The fix

Two changes, both in the same area feature 14 touched:

1. **Full-page coverage.** Keep the exact same sampling mechanism (the 40x22
   canvas drawing the live `<video>` frame via `drawImage`, on the same
   `play`/`pause`/`seeked` lifecycle) but change how it's *displayed*: instead
   of a small `position: absolute` layer bled past `.player-card`'s edges, the
   canvas becomes a `position: fixed; inset: 0` layer covering the full
   viewport, teleported to `<body>` (`<Teleport to="body">`) so it can never
   get trapped inside a local CSS stacking context no matter what other
   component styling exists elsewhere on the page - the most robust way to
   guarantee "the *whole* background," not just what happens to be near the
   player. This also means `.player-card`'s `position: relative; z-index: 1`
   and the `.player-ambient-host` wrapper `/implement` added for feature 14
   are no longer needed and come back out - the local-halo approach they
   supported is gone.
2. **A toggle, not always-on.** A fourth toggle, "Ambient mode", joins Hide
   Video / Hide Info / Start at random times in `StudyDisplayToggles.vue`
   and `/study`'s toggle row - same visual treatment, no keyboard shortcut
   (matching "Start at random times", which also has none). It defaults to
   **off** and resets every session, matching the other three toggles
   exactly rather than making this one behave specially.
   `/study` passes the toggle's live value as `StudyMediaPlayer`'s `ambient`
   prop instead of a hardcoded `true`.

**"Only when video is being shown"**, from the request, is already how the
prop works today (the glow is gated on `quizType === 'video'` - not
audio-only, not Hide Video) and stays that way; the new toggle is an
additional user-controlled gate on top of it, not a replacement. The toggle
button itself always shows in the row, exactly like Hide Video does even on
an audio-only card (where it's already a no-op today) - not a new
appears/disappears-by-card-type pattern this codebase doesn't otherwise have.

Must not break: feature 12's cover-art thumbnails, the existing veil/paused
states, or `CardPreviewModal` (still never passes `ambient`, unaffected
either way).

## Build steps

- [x] **Step 1 - Full-page glow layer + Ambient mode toggle** - in
  `StudyMediaPlayer.vue`: wrap the ambient `<canvas>` in `<Teleport
  to="body">`; restyle it (`position: fixed; inset: 0; width: 100vw; height:
  100vh; z-index: -1; filter: blur(80px) saturate(1.6) brightness(0.9);
  opacity: 0.55; pointer-events: none;`) as a `:global()` rule inside the
  scoped `<style>` block (teleported content isn't reachable by normal
  scoped selectors); remove the now-unneeded `.player-ambient-host` wrapper
  div and its CSS, and revert `.player-card`'s `position: relative; z-index:
  1` back out. In `StudyDisplayToggles.vue`: add `ambientMode: boolean` to
  props, `"toggle-ambient-mode": []` to emits, and an "Ambient mode" button
  matching the other three. In `study/index.vue`: add `const ambientMode =
  ref(false)`, wire the new prop/emit on `<StudyDisplayToggles>`, and change
  `<StudyMediaPlayer>`'s `:ambient="true"` to `:ambient="ambientMode"`.
  *Done when:* `bun run build` stays clean; with Ambient mode off (the
  default), `/study` looks exactly as it did before feature 14 - no glow
  anywhere; switching it on with a video-backed card showing produces a
  blurred glow across the *entire* visible page background (not just near
  the player), that shifts color as the clip plays and freezes on pause;
  switching it back off removes the glow immediately; an audio-only card or
  Hide Video active shows no glow regardless of the toggle's state, matching
  today's behavior.

## Verify

No test runner configured, so this rides on direct verification - same
limitation as feature 14 itself: **no browser tool is available in this
session**, so I can't personally watch this one either. Manual check: open
`/study` with a video-backed due card, confirm no glow by default, click
"Ambient mode" on, confirm the glow now visibly covers the page background
(not just a halo behind the player) and updates live, click it off, confirm
it's gone. `bun run build` clean is the only automated evidence I can
produce myself.
