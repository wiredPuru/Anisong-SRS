# Feature: Auto-reveal timer for Hide Info

**From build-plan:** feature 38
**Status:** verified

## Goal

On `/study`, when Hide Info (feature 10) is active, add an optional
persisted "Auto Reveal" preference: instead of the info panel staying
blurred until the user manually reveals it, it automatically un-blurs on
its own after a short, visibly counting-down timer. The timer re-arms on
every new card presentation - including a repeat after a fail, not just
once per session - so each card is hidden again first and only reveals
itself after the countdown finishes, letting the user try to recall the
answer before it's shown, without needing to hit the reveal hotkey by
hand every time. If Hide Video is also on when the timer fires, the video
reveals itself at the same moment as the info - the countdown reveals the
whole answer, not just the text half of it. The countdown itself doesn't
start until the user actually starts playback (video or audio) for that
card - it shouldn't tick away while they're still getting ready - and it
renders directly on the (blurred) info panel itself, not as a separate
floating element elsewhere on the screen.

## In scope

- A new "Auto Reveal" toggle on `/study`, alongside the existing Hide
  Video / Hide Info / Random Start display toggles (`StudyDisplayToggles.vue`).
  Disabled (visibly, via `:disabled`) whenever Hide Info is off, since it
  has nothing to act on otherwise.
- The toggle's on/off state persists across sessions via `localStorage`
  (key `gaqSrs:autoReveal`), matching the existing `gaqSrs:studyAmbientMode`
  pattern in `study/index.vue` (manual `getItem`/`setItem` in a
  `try`/`catch`, read on mount, written on change) - not the session-only
  reset-per-visit behavior Hide Video/Hide Info/Random Start already have.
- A configurable countdown duration, persisted via `localStorage`
  (key `gaqSrs:autoRevealSeconds`, default 5s, clamped to a 1-30s range),
  editable via a small number input shown next to the Auto Reveal toggle
  whenever it's on.
- A visible countdown indicator, shown only while Hide Info + Auto Reveal
  are both on, playback has started, and the current card hasn't
  auto-revealed yet: a plain ticking number counting down to zero (no
  progress bar - simplicity is the point), overlaid on the info panel.
- Re-arming on every new card presentation (via the existing
  `presentationKey` counter from `useStudySession`, which already bumps on
  a repeat of the same card id after a fail, not just on a genuinely new
  card) - each new presentation starts hidden again and counts down again.
- Applying to both `/study` layouts that already exist: the normal side
  info panel (blur) and the immersive overlay (feature 31 - info panel not
  rendered at all while hidden). Both are driven by the same `hideInfo`
  prop passed into `StudyInfoPanel`, so both get auto-reveal without
  `StudyInfoPanel.vue` itself needing to know auto-reveal exists.
- When the timer fires, Hide Video is revealed too if it was on -
  `StudyMediaPlayer`'s existing `hideVideo` prop gets the same
  timer-driven override as `StudyInfoPanel`'s `blurred` prop, so "reveal"
  means the whole answer (video and info together), not just the text.
  Hide Video with Auto Reveal off, or with Hide Info off (Auto Reveal is
  disabled in that case - see above), is completely unaffected: the video
  only ever stays hidden until manually toggled, exactly as it does today.

## Out of scope

- `CardPreviewModal` - it reuses `StudyMediaPlayer`/`StudyInfoPanel` but
  never had a Hide Info toggle in the first place (feature 10 is
  `/study`-only), so there's nothing for Auto Reveal to attach to there.
- A separate "Auto Reveal Video" toggle, or auto-revealing video
  independent of Hide Info - the video only auto-reveals as part of the
  same Hide-Info-driven timer, never on its own.
- Manually revealing info early (turning Hide Info off, or the `i`
  hotkey) does not also reveal a hidden video - only the automatic timer
  ties the two together. Manual reveal of each stays exactly as
  independent as it is today.
- Any change to Random Start or the language toggles.
- Any change to `StudyInfoPanel.vue`'s own blur/overlay rendering logic -
  it keeps taking a single `blurred` boolean and doesn't need to know why
  that boolean is currently `false`.
- A hotkey for the new toggle - like "Start at random times," it's a
  session-shaping preference set via the toggle button, not something
  toggled mid-card.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - persisted Auto Reveal toggle** - Add an `autoReveal` ref
  in `study/index.vue`, read from `localStorage` (`gaqSrs:autoReveal`) on
  mount and written on every change, mirroring the existing
  `gaqSrs:studyAmbientMode` read/write block. Add the "Auto Reveal" button
  to `StudyDisplayToggles.vue` (new prop for its state, new emit to toggle
  it, `:disabled="!hideInfo"` so it visibly can't be turned on while Hide
  Info is off). *Done when:* toggling "Auto Reveal" on `/study`, then
  reloading the page, shows the toggle still on (or still off); it stays
  disabled/enabled correctly as Hide Info is flipped.

- [x] **Step 2 - timer engine wired to blur + video state** - Add
  `autoRevealedThisCard` (ephemeral, not persisted) and a pending-timeout
  ref in `study/index.vue`. One `watch([presentationKey, hideInfo,
  autoReveal], ...)` (with `{ immediate: true }`) clears any pending
  timeout, resets `autoRevealedThisCard` to `false`, and - only when both
  `hideInfo` and `autoReveal` are true - starts a 5-second `setTimeout`
  that sets `autoRevealedThisCard` to `true`. Clear the pending timeout in
  `onUnmounted`. Change both existing `:blurred="hideInfo"` bindings on
  `StudyInfoPanel` (the normal-layout usage and the immersive-overlay
  usage) to `:blurred="hideInfo && !autoRevealedThisCard"`, and change
  `StudyMediaPlayer`'s existing `:hide-video="hideVideo"` binding to
  `:hide-video="hideVideo && !autoRevealedThisCard"` - the same reveal
  flag gates both, so Hide Video only ever changes behavior when it was
  actually on. *Done when:* with Hide Info + Auto Reveal both on, a card's
  info silently un-blurs on its own ~5s after it's shown, with no visible
  indicator yet; if Hide Video was also on, the video reveals itself at
  the same moment; if Hide Video was off, the video stays visible the
  whole time exactly as today; toggling Auto Reveal off while a countdown
  is pending leaves the card hidden with no reveal; passing or failing a
  card re-hides the next card's info (and video, if Hide Video is on).

- [x] **Step 3 - visible countdown indicator** - Add a small, focused
  `StudyAutoRevealCountdown.vue` component (`components/study/`, named
  with the `Study` prefix so Nuxt's directory-based auto-import registers
  it correctly - a plain `AutoRevealCountdown.vue` in this folder would
  register as `<StudyAutoRevealCountdown>` anyway, same gotcha the
  `CardPreviewModal` component already ran into) rendered alongside
  `StudyInfoPanel` whenever `hideInfo && autoReveal && !autoRevealedThisCard`.
  Give it `:key="presentationKey"` so it remounts fresh each presentation,
  and drive the countdown via a CSS `animation` on a bar that starts full
  on mount and shrinks to empty over the same 5-second duration Step 2
  uses (a shared constant, not two hardcoded numbers) - no per-second JS
  ticking needed. Style it with existing `--surface`/`--glass-*`/
  `--accent-secondary` tokens. *(Superseded by Step 5 - the bar became a
  plain ticking number per review feedback.)*

- [x] **Step 4 - gate the timer on playback actually starting, and
  overlay the countdown on the info panel** - Two follow-up corrections
  from review:
  - **Gate on playback start.** `StudyMediaPlayer.vue` gains a
    `playback-started` emit, fired from its existing `onPlay()` handler
    (used by the video element; the audio element's inline `@play`/
    `@pause` handlers are unified to call the existing `onPlay`/`onPause`
    functions instead of setting `isPlaying` directly, so both media
    kinds emit the same way). `study/index.vue` adds
    `hasStartedPlaybackThisCard` (ephemeral, reset with each new
    presentation), listens for `@playback-started` to set it `true`, and
    the Step 2 timer watcher only starts its `setTimeout` when
    `hideInfo && autoReveal && hasStartedPlaybackThisCard` are all true -
    not just the first two. A card that's hidden but never played never
    starts counting down.
  - **Overlay on the info panel.** Move `StudyAutoRevealCountdown` from a
    separate sibling pill to an absolutely-positioned overlay centered
    directly on top of `StudyInfoPanel`'s own box (its blurred/frosted
    card), in both the normal side-panel layout (wrap `StudyInfoPanel` in
    a small `position: relative` wrapper) and the immersive layout
    (`.info-slot` already establishes a containing block for its one
    child, so the countdown can position within it directly). It still
    doesn't require any change to `StudyInfoPanel.vue` itself - the
    overlay positioning is entirely in the parent template/CSS.
  *Done when:* a card that's hidden but sitting unplayed shows no
  countdown and never auto-reveals; pressing play starts a countdown
  that visibly sits on top of the blurred info card itself (not
  floating elsewhere) and reveals info (and video, if hidden) ~5s later.

- [x] **Step 5 - configurable duration + plain numeric countdown** - Two
  more follow-up corrections from review:
  - **Configurable duration.** Replace the `AUTO_REVEAL_SECONDS` constant
    in `study/index.vue` with an `autoRevealSeconds` ref, persisted via
    `localStorage` (key `gaqSrs:autoRevealSeconds`, read/write following
    the same pattern as `autoReveal`), defaulting to 5 and clamped to a
    1-30 second range on both read and write (a stray/garbage stored value
    or a bad input never produces a zero, negative, or absurd duration).
    `StudyDisplayToggles.vue` gains an `autoRevealSeconds` prop and an
    `update-auto-reveal-seconds` emit, rendering a small `number` input
    (matching the existing `SettingsBoxOneStreakControl`-style native
    input, not a new custom stepper widget) next to the Auto Reveal
    button, shown only while Auto Reveal is on. The timer watcher's
    `setTimeout` duration and the countdown component's `seconds` prop
    both read from this ref instead of the old constant; changing the
    duration while a countdown is already running restarts it for the
    current card using the new duration (same reset-on-any-dependency-
    change behavior the watcher already has).
  - **Plain numeric countdown.** Replace `StudyAutoRevealCountdown.vue`'s
    shrinking bar with a real ticking number: an internal `remaining` ref
    initialized to the `seconds` prop, decremented once a second via
    `setInterval` (cleared at zero or on unmount), rendered as a plain
    "Revealing in {remaining}" display - no bar, no keyframe animation.
    This is a real per-second tick (unlike Step 3's CSS-only approach),
    which is fine now that duration is user-configurable and worth
    reading exactly.
  - **Ambient-glass consistency.** The new seconds `<label>` reuses the
    existing `.toggle-btn` class (in addition to its own layout class)
    instead of declaring its own separate pill styling, so it - and the
    plain `<input>` inside it - match the other display toggles exactly,
    including the shared `[data-ambient-glass="true"] .display-toggles
    .toggle-btn` rule in `main.css` that already gives every other pill in
    this row its glass look when ambient mode is on. Without this, the
    new input rendered as a solid box that didn't match its siblings once
    ambient mode turned the rest of the row translucent.
  *Done when:* the number input next to Auto Reveal accepts a new value,
  persists across a page reload, and the countdown on the next hidden
  card counts down from that new value instead of 5; the on-screen
  countdown is a plain number ticking 5, 4, 3, 2, 1 (or whatever duration
  is set) with no bar; with ambient mode on, the seconds input looks like
  a natural part of the toggle row, not a separate solid box.

## Files / areas

- `nuxt-app/app/pages/study/index.vue` - `autoReveal` + `autoRevealSeconds`
  refs with localStorage read/write, `autoRevealedThisCard` +
  `hasStartedPlaybackThisCard` refs, timer watcher, updated `:blurred`
  bindings, updated `StudyMediaPlayer` `:hide-video`/`@playback-started`
  bindings, `<StudyAutoRevealCountdown>` overlaid on the info panel in
  both layouts.
- `nuxt-app/app/components/study/StudyDisplayToggles.vue` - new toggle
  button + emit, plus a number input for `autoRevealSeconds`.
- `nuxt-app/app/components/study/StudyAutoRevealCountdown.vue` - new.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - new
  `playback-started` emit fired from `onPlay()`; audio element's inline
  `@play`/`@pause` unified to call `onPlay`/`onPause`.
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - no logic change;
  still just consumes whatever `blurred` boolean it's given.

## Data / contracts

- No schema, API, or type changes - this is entirely client-side state.
- New `localStorage` keys: `gaqSrs:autoReveal` (`"true"`/`"false"`, same
  convention as `gaqSrs:studyAmbientMode`) and `gaqSrs:autoRevealSeconds`
  (stringified integer, clamped 1-30 on read).

## Testing

No test runner is configured in `AGENTS.md` (Testing is opt-in for this
project). This feature is pure UI/timing behavior wired through Vue
reactivity and `setTimeout`/CSS transitions - no parser/formatter/validator
logic to isolate. Verify with the running app: start a study session with
Hide Info and Auto Reveal both on, confirm the countdown animates and the
card reveals itself around 5s, confirm the next card (including a repeat
after a fail) starts hidden and counts down again, confirm turning Auto
Reveal off stops the auto-reveal behavior, and confirm the toggle's on/off
state survives a page reload. Also verify the Hide Video interaction: with
Hide Video off, the video stays visible the entire time regardless of Auto
Reveal; with Hide Video on too, the video reveals itself at the same
moment the info does. Verify the playback gate: with Hide Info + Auto
Reveal on and playback not yet started, no countdown appears and nothing
auto-reveals no matter how long the card sits; pressing play (video or an
audio-only card) starts the countdown, visibly overlaid on the info panel
itself. Screenshot the countdown mid-animation in both the normal and
immersive layouts as build evidence.

## Notes for the AI

- Reuse the manual `localStorage.getItem`/`setItem` + `try`/`catch`
  pattern already used for `gaqSrs:studyAmbientMode` and
  `gaqSrs:playerVolume` - this project has no shared `useLocalStorage`
  composable, and one shouldn't be introduced just for this.
  `hideVideo`/`hideInfo`/`randomStart` stay session-only refs, unchanged;
  only the new `autoReveal` preference is persisted.
- Define the 5-second duration as a single named constant shared between
  the timer (Step 2) and the countdown animation (Step 3) - don't
  hardcode the number twice.
- The single `watch([presentationKey, hideInfo, autoReveal], ...)` design
  is intentional: it uniformly handles a new card, Hide Info being
  toggled, and Auto Reveal being toggled, without special-casing each
  transition separately. Don't add extra watchers for the same state.
- `StudyInfoPanel.vue` must not need to know Auto Reveal exists - it
  already just takes `blurred` as a boolean; keep that contract intact so
  Preview's own (unrelated) usage of the same component is untouched.
