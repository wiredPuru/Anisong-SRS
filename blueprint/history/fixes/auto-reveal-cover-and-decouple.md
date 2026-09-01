# Fix: Auto Reveal - always selectable, hides the right visual, pauses with playback

**Type:** Fix
**Status:** verified

## The problem

This spec started narrower ("Auto Reveal doesn't reveal cover art like it
reveals video") and is now expanded in place, on the same branch, to cover
the fuller redesign requested next. Step 1 below (already applied,
uncommitted) is the original narrow fix; Steps 2-3 are the new scope.

Today, Auto Reveal (feature 38) is gated entirely behind Hide Info: the
toggle is `:disabled="!hideInfo"` in `StudyDisplayToggles.vue`, and the
countdown timer in `study/index.vue` only arms when `hideInfo.value &&
autoReveal.value && started`. Auto Reveal's only real job is un-blurring
the info panel; it un-hides video/cover as a side effect only if the user
*also* separately toggled Hide Video/Hide Cover on. This makes Auto Reveal
useless on its own for someone who just wants "hide the video/cover, then
reveal it after a timer" without touching Hide Info at all.

Separately, the countdown itself is a plain wall-clock `setTimeout` armed
once playback first starts (`hasStartedPlaybackThisCard`). It never reacts
to a later pause: if the user pauses partway through, the timer keeps
ticking in the background and can fire (revealing the answer) while
playback is sitting paused - defeating the point of a "how long can you
guess before it's revealed" timer.

## The fix

1. **Auto Reveal selectable always** - remove `:disabled="!hideInfo"` from
   both the toggle button and the seconds input in
   `StudyDisplayToggles.vue`. Update the toggle's tooltip text, since
   "Reveals Hide Info automatically" is no longer the whole story.
2. **Auto Reveal hides the relevant visual itself** - in `study/index.vue`,
   change the props passed to `<StudyMediaPlayer>` from
   `hideVideo && !autoRevealedThisCard` / `hideCover && !autoRevealedThisCard`
   to `(hideVideo || autoReveal) && !autoRevealedThisCard` /
   `(hideCover || autoReveal) && !autoRevealedThisCard`. Auto Reveal now
   hides whichever one actually applies to the current card on its own
   (a video-capable card's `hideVideo` prop already no-ops on an
   audio-only card and vice versa via `StudyMediaPlayer`'s existing
   `mediaKind`/`quizType` logic - "hides video and hides cover when it
   makes sense" falls out of that for free, no new branching needed). Drop
   the `hideInfo.value &&` requirement from the timer's arm condition in
   the same file, and from the countdown indicator's `v-if` (both
   occurrences) - Auto Reveal now runs independently of Hide Info.
3. **Countdown pauses with playback** - add a `"playback-paused": []`
   emit to `StudyMediaPlayer.vue`, fired from its existing `onPause()`
   handler. In `study/index.vue`, track elapsed vs. remaining time instead
   of a single fire-and-forget `setTimeout`: pausing playback clears the
   pending timeout and records the remaining milliseconds; the next resume
   (the existing `playback-started` emit, which - unlike its name suggests
   - already fires on every resume-from-pause via the native `playing`
   event, not just the first start) re-arms the timer with the remaining
   time instead of the full duration. A genuinely new card, or toggling
   Auto Reveal/changing the seconds value, still resets to a fresh full
   countdown, matching today's behavior for those cases.

Must not break:

- A video-capable card with Hide Video manually on, Auto Reveal off:
  stays hidden until manually toggled, exactly as today (`hideVideo ||
  false` with `autoRevealedThisCard` never becoming true since the timer
  never arms without Auto Reveal on).
- Hide Info's own blur/reveal (`StudyInfoPanel`'s `:blurred` prop) is
  untouched - still `hideInfo && !autoRevealedThisCard`, so Auto Reveal
  still reveals a blurred info panel when Hide Info happens to be on too.
- A card with no video and no cover image (nothing for Auto Reveal to
  hide) is unaffected either way - both hide props already no-op in that
  case.
- `CardPreviewModal` is unaffected - no Hide Info/Auto Reveal UI there to
  begin with.
- Pausing/resuming repeatedly must not accumulate drift or let the
  countdown fire early/late by more than normal `setTimeout` granularity.

## Build steps

- [x] **Step 1 - tie Hide Cover to the auto-reveal timer** (original
  narrow fix, already applied) - `:hide-cover` changed from `hideCover` to
  `hideCover && !autoRevealedThisCard` in `study/index.vue`. Superseded in
  shape by Step 2 below (`(hideCover || autoReveal) && !autoRevealedThisCard`)
  but the underlying behavior - Hide Cover reveals with the timer - carries
  forward unchanged.
- [x] **Step 2 - decouple Auto Reveal from Hide Info** - remove the
  `:disabled="!hideInfo"` guards in `StudyDisplayToggles.vue`; update the
  arm condition and both countdown-indicator `v-if`s in `study/index.vue`
  to drop `hideInfo.value &&`; change the `hide-video`/`hide-cover` props
  to the `(hideVideo || autoReveal)` / `(hideCover || autoReveal)` form.
  *Done when:* Auto Reveal's toggle and seconds input are clickable with
  Hide Info off; turning on Auto Reveal alone (Hide Video/Hide Cover both
  off) hides the relevant visual for a card and reveals it after the
  countdown; Hide Info's own blur behavior is unchanged.
- [x] **Step 3 - pausable countdown** - add the `playback-paused` emit to
  `StudyMediaPlayer.vue`; rework the timer state in `study/index.vue` to
  track remaining time across pauses, driven by the new
  `@playback-paused` handler and the existing `@playback-started`
  handler (now also treated as "resumed"). *Done when:* pausing playback
  mid-countdown freezes the reveal (it does not fire while paused);
  resuming continues counting down from where it left off, not from the
  full duration again; a brand-new card, toggling Auto Reveal, or
  changing the seconds value still starts a fresh full countdown.

## Verify

- With Hide Info off, turn on Auto Reveal (short countdown) on a
  video-capable card: confirm the toggle/seconds input are enabled, video
  hides on play, and reveals when the countdown finishes - text info is
  never blurred throughout (Hide Info stayed off).
- Repeat on a naturally audio-only/cover-art card: cover/record hides and
  reveals the same way.
- Turn Hide Info on too, alongside Auto Reveal: confirm info, video/cover
  all reveal together at the same instant.
- Start playback with Auto Reveal counting down, pause partway through,
  wait past the original full duration while paused, and confirm the
  answer has *not* revealed itself; resume and confirm it reveals after
  only the remaining time, not the full duration again.
- Confirm a video-capable card with Hide Video manually on and Auto
  Reveal off still stays hidden until manually toggled.
- Run `bun run build` as the final check (no `Verify` command is
  configured in `AGENTS.md` yet).
