# Fix: Party credits guard (global mask zone + start floor)

**Type:** Fix
**Status:** verified

## The problem

Clips from animethemes.moe (and some others) carry burned-in title text: a
credits box, usually bottom-left, in roughly the first 10 seconds. In party mode
the only defence is the existing per-song censor (boxes drawn by the host, saved
per song by `partyCensorStore.ts`), which means doing it one clip at a time, and
Random start can still land inside that window. Wanted: a one-time setup that
protects every song without per-song work.

## The fix

Two host settings that apply to every song on the display, building on the
existing censor machinery rather than replacing it.

1. **Credits guard (global mask zone).** One host-configured box, in the same
   fractional `PartyCensorBox` shape and drawn/dragged/resized with the same
   helpers as `PartyCensorPanel` (`partyCensorBoxes.ts`). Has an on/off toggle
   ("Hide credits box") and uses the existing censor style (black or blur).
   Rendered by `PartyDisplayPlayer.vue` alongside the per-song censor boxes
   (they combine; neither replaces the other), over video clips only.
2. **Start floor.** A minimum start time in seconds (default 10, host-editable,
   0 = off). When the start is random (Random start, and lightning rounds),
   the start becomes `floor + startFraction * (duration - tail - floor)`, so it
   never lands before the floor. A clip too short for the floor falls back to
   today's behaviour. A fixed `startAt` or a host seek is never moved.

Details to settle at build time, in this order of preference:

- **Lifted on reveal?** The per-song censor deliberately stays on at reveal;
  the guard should behave the same (still hiding the credits box).
- **Time limit.** Option to apply the guard only for the first N seconds of the
  clip (default: whole clip) so the box is not covering real picture all song.
  Only add if cheap; otherwise leave for later.
- **Persistence.** Must survive restarts of `gaq-party` and a new game, like the
  per-song tracks. Prefer the existing censor store pattern or the host's
  existing kept-settings route over a new migration; add a Drizzle migration
  only if nothing existing fits.
- **No leaks.** The guard box and floor are layout settings only, no answer data.

Must not break: per-song censor tracks and recording, the blur/black glow
handling (`drawGlow` hides black boxes from the ambient glow), effects, lightning
random starts, Skip to end, and the Study/Listen Random start
(`app/utils/randomStart.ts`), which are out of scope.

Out of scope (later): OCR scan of clips, auto-detected per-song masks, a batch
review grid.

## Build steps

- [x] **Step 1 - Start floor.** Pure helper (new, with a Vitest test) computing
  the start from fraction, duration, tail, and floor; used by
  `PartyDisplayPlayer.vue` `startCurrent()`. Host setting for the floor in the
  Now playing / Effects area, carried in game state and surviving End game.
  *Done when:* with floor 10, repeated random-start loads of a long clip never
  begin before 10s; floor 0 behaves as before; a short clip still starts.
- [x] **Step 2 - Credits guard box.** Setting (enabled + box), a small editor in
  `PartyCensorPanel` (or an adjacent panel) over the host preview, persisted per
  the note above, and rendered on the display with the existing censor styling.
  Pure box validation covered by a test. *Done when:* drawing the box once
  masks the same region on every song on the display, toggling it off removes
  it, it survives a restart, and it coexists with a per-song censor.

## Verify

- `bun run test` and `bun run build` from `nuxt-app/` (build in an isolated
  copy if a party server is running).
- In the browser: load a queue of animethemes.moe clips, enable Random start
  with floor 10, step through several songs and confirm start times; draw the
  guard box over the bottom-left and confirm it covers the title card on the
  display, stays at reveal, and combines with a per-song censor; restart
  `bun run party` and confirm both settings are kept.
