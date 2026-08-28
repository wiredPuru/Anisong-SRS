# Feature: Study session display toggles

**From build-plan:** feature 10
**Status:** verified

## Goal

Three session-only toggles on `/study` - Hide Video, Hide Info, Start at
random times - so a study session can be made harder/more AMQ-realistic
on demand: guess from audio only, guess with no title/artist info showing,
and not always start listening from the very beginning of a clip.

## In scope

- A new toggle row on `/study` with three pill buttons: **Hide Video**,
  **Hide Info**, **Start at random times**. Off by default, reset every time
  a session starts (no persistence - confirmed: session-only, like the
  existing EN/Romaji/JP toggles).
- **Hide Info**: while on, `StudyInfoPanel` (title/artist/box) stays mounted
  but gently blurs to illegible via a CSS filter transition (not an abrupt
  show/hide); toggling off unblurs the same way.
- **Hide Video**: while on, no card shows its video frame, even a
  video-only card - it keeps playing through the video element (for its
  embedded audio track) behind a visually-veiled player (the existing
  audio-only presentation, upgraded per below). Confirmed: toggling Hide
  Video must never interrupt in-progress playback, so which element/src is
  mounted is independent of the toggle - only the veil changes. (An earlier
  version of this step preferred a card's dedicated audio source when
  hiding, which saved bandwidth but swapped the mounted element and reset
  playback to paused - removed once that surfaced as a bug.)
- **Audio veil polish** (folds into Hide Video's work since it's the same
  markup): replace the static "🎵 Listening..." icon with a small animated
  equalizer (a few bars bouncing via CSS keyframes), shown only for the
  actual "Listening..." (audio) state - not for a genuinely paused video,
  which keeps its plain "Paused" text with no animated icon (showing an
  animated "listening" indicator while nothing is playing read as wrong).
  The audio-state veil is also fully opaque (no `backdrop-filter` blur-through)
  so a video frame rendering underneath - the video-only-card-with-Hide-Video
  fallback case - never leaks any visual information; the ordinary
  paused-video veil keeps its existing translucent blur look, since that
  case has nothing to hide. The existing scrub/progress bar below the frame
  is untouched and already visible in this state - no second progress
  indicator is added inside the veil itself.
- **Start at random times**: while on, each *presentation* of a card (not
  just each distinct card id) starts playback at a random point instead of
  `0`, chosen from `[0, duration - 15s]` (or `0` if the clip is 15s or
  shorter, per "except the last 15 seconds"). Confirmed: this must reapply
  on a repeat presentation of the *same* card too - e.g. failing a card
  (which is immediately due again under the box-1 0-day interval) and
  getting it back right away still gets a freshly-random start, not a
  continuation of wherever it was left. Pausing/resuming within one
  presentation does not re-randomize.

## Out of scope

- Persisting toggle state across sessions or per-card - session-only, no new
  settings/storage.
- Retroactively re-seeking a clip that's already loaded when "Start at
  random times" is switched on mid-card - it applies starting with the next
  card that loads.
- Preserving playback position when "Hide Video" is flipped mid-clip -
  switching modes swaps the underlying `<video>`/`<audio>` element, which
  naturally restarts that clip; this is expected, not a bug to prevent.
- Any change to the download-progress-bar or live-card-refresh issues raised
  separately - those are queued as their own follow-up work, not part of
  this feature.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight
   on. Checkpoints are optional; `/complete` makes the real feature-level
   commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the
step was too big, so split it.

## Build steps

- [x] **Step 1 - Toggle bar + Hide Info** - new
  `nuxt-app/app/components/study/StudyDisplayToggles.vue`: three pill
  buttons (`hideVideo`, `hideInfo`, `randomStart` booleans in/out via props +
  emits, matching `StudyAnswerControls.vue`'s prop/emit style), visually
  showing on/off state like `StudyInfoPanel`'s existing `.lang-btn.on`
  pattern. Wire three `ref(false)` in `study/index.vue`, place the toggle
  row above `.study-grid` (outside both `StudyMediaPlayer` and
  `StudyInfoPanel`, since hiding info must not hide the toggle that un-hides
  it). `StudyInfoPanel.vue` gets a `blurred` prop; when true its root
  element gets a CSS `filter: blur(...)` with a `transition: filter` so it
  gently blurs/unblurs in place (stays mounted, never `v-if`-removed) -
  driven by `:blurred="hideInfo"` from the parent. The other two toggles are
  visually wired but don't affect playback yet (steps 2-3). *Done when:* in
  the browser, all three toggles visibly flip on/off when clicked, and
  toggling Hide Info smoothly blurs/unblurs the info panel (not an abrupt
  show/hide) with its content illegible while blurred; a fresh page load
  always starts with all three off. Also bind the `i` key (in
  `study/index.vue`, matching `StudyAnswerControls.vue`'s
  `onMounted`/`onUnmounted` `window.addEventListener("keydown", ...)`
  pattern) to toggle Hide Info the same as clicking the button.
- [x] **Step 2 - Hide Video + audio veil polish** - in `StudyMediaPlayer.vue`,
  add a `hideVideo` prop. Split the existing `quizType` computed into
  `mediaKind` (which element/src actually mounts - video if the card has
  video, else audio; deliberately does **not** depend on `hideVideo`, so the
  toggle never swaps the mounted element mid-playback) and `quizType`
  (display only: `hideVideo` ? `"audio"` : `mediaKind`). Update the
  template's `v-if`/`v-else-if` and `activeEl` to key off `mediaKind`
  instead of `quizType`; `showVeil` and the rest stay keyed off `quizType`
  unchanged. Pass `:hide-video="hideVideo"` from `study/index.vue`. Replace
  the static 🎵 icon in the veil with a small CSS-only animated equalizer (a
  handful of bars bouncing on staggered `@keyframes` delays), shown only
  while actually playing (`isPlaying`) in the audio veil - a genuinely
  paused state (including a paused, Hide-Video-hidden card) shows plain
  "Paused" text with no animation, not "Listening..." with bars still
  bouncing. The
  audio-state veil is fully opaque (no `backdrop-filter` blur-through) so a
  video frame still rendering underneath never leaks any visual information;
  the plain paused-video veil keeps its existing translucent blur look.
  Also bind the `v` key (`study/index.vue`, same `onKeydown` handler as `i`)
  to toggle Hide Video, with a matching hover tooltip on the button. *Done
  when:* with Hide Video on, a video-backed card (with or without a
  separate audio source) shows the opaque veil with the animated equalizer
  instead of its video frame, and sound still plays without any
  interruption to in-progress playback; a card whose only source is video
  (no dedicated audio) still produces sound with Hide Video on; toggling
  Hide Video via click or the `v` key mid-playback never pauses/restarts the
  clip; a genuinely paused video shows plain "Paused" text with no animated
  icon; an ordinary audio-only card (Hide Video off) also shows the new
  animated equalizer instead of the old static icon.
- [x] **Step 3 - Start at random times, per presentation** - give
  `useStudySession.ts` a `presentationKey` counter (`ref(0)`), incremented
  every time `fetchNext()` assigns a new `currentCard` (including a repeat
  of the same card id, e.g. right after a fail). In `study/index.vue`,
  switch `StudyMediaPlayer`'s `:key` from `currentCard.id` to
  `presentationKey`, so every presentation - even a same-card repeat - is a
  genuinely fresh component mount and refires `loadedmetadata`. Add a
  `randomStart` prop to `StudyMediaPlayer.vue`; reuse the duration-resolution
  paths already fixed for the scrub bar (both the fast "duration already
  finite" branch and the `durationchange` fallback branch): once a
  presentation's real duration is known, if `randomStart` is on, set
  `el.currentTime = Math.random() * Math.max(resolvedDuration - 15, 0)`
  instead of leaving it at `0`. Pass `:random-start="randomStart"` from
  `study/index.vue`. *Done when:* with the toggle on, a due card longer than
  15s starts partway through (not at 0:00); failing that same card and
  having it come back immediately (only/earliest due card) produces an
  independently-random start again, not a continuation of where it was
  left; a card 15s or shorter starts at 0; with the toggle off, a repeat
  presentation still restarts cleanly at 0 (the remount fix applies
  regardless of the toggle) rather than resuming a stale paused position.

## Files / areas

- `nuxt-app/app/components/study/StudyDisplayToggles.vue` - new.
- `nuxt-app/app/pages/study/index.vue` - toggle state + wiring.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - `hideVideo` /
  `randomStart` props and the `mediaKind`/duration-resolution changes.

## Data / contracts

None - no schema, API, or shared-type changes. All three toggles are plain
component-local booleans (`ref(false)`) owned by `study/index.vue`, passed
down as props. Nothing here is load-bearing for a later feature.

## Testing

No test runner configured (`AGENTS.md` Commands has no `test` entry), and
all three toggles are interactive client-side behavior with no server
component, so this rides entirely on browser verification, not unit tests:

- Step 1: browser check of toggle visuals and the Hide Info show/hide.
- Step 2: browser check with both a video+audio card and a video-only card
  (no dedicated audio source) to confirm the fallback-to-video-element-audio
  path actually produces sound.
- Step 3: browser check of a clip >15s (starts partway, stays put across
  pause/resume) and, if a card ≤15s is available, confirms it starts at 0.

No Playwright in this project (per `coding-standards.md`, not added
silently here) - each step's done-when needs your confirmation in a real
browser, the same as the scrub-bar fix.

Standing convention from here on: any button that gets a keyboard hotkey
also gets a hover tooltip showing it. The native `title` attribute was
tried first but only triggers over the button's text glyphs in some
browsers, not its full padded hit area, so it's a custom
`<span class="tooltip">` inside the button instead, shown via
`:hover`/`:focus-visible` on the parent (covers the whole button regardless
of cursor position within it). Wired this way so far: Hide Info -> `I`, Hide Video -> `V`
(both `StudyDisplayToggles.vue`/`study/index.vue`), play/pause -> `S`
(`StudyMediaPlayer.vue`) - all added after their respective build steps on
request. The `.tooltip` CSS is duplicated per component (scoped styles,
same pattern as this codebase's existing per-page `.state`/`.state-error`
duplication) rather than extracted, since it's only two small components
using it so far. Start at random times has no hotkey unless requested, so
no tooltip on that one yet.

## Notes for the AI

- This feature builds directly on the scrub-bar fix already merged
  (`StudyMediaPlayer.vue`'s duration-resolution logic) - step 3 extends that
  same code path rather than duplicating it.
- Keep `mediaKind` vs `quizType` genuinely separate per Step 2: `mediaKind`
  answers "which DOM element and src," `quizType` answers "do we show the
  frame." Conflating them is what would make the video-only + Hide Video
  case go silent.
- `StudyDisplayToggles.vue` follows the same props/emits shape as
  `StudyAnswerControls.vue` (no v-model sugar elsewhere in this codebase, so
  don't introduce it here either).
- Toggle row goes in `study/index.vue`, not inside `StudyInfoPanel.vue` or
  `StudyMediaPlayer.vue` - it must stay visible regardless of what the
  toggles themselves hide.
