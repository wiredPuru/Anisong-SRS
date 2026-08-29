# Feature: Expand toggle on /study's player

**From build-plan:** feature 23
**Status:** verified

## Goal

`CardPreviewModal` already has an expand button (feature 20) that grows the
whole modal to fill the viewport. `/study`'s own player has no equivalent -
the video is boxed into the left column of a two-column grid (player +
side info/pass-fail panel) and can't be made bigger without leaving the
page. This adds a dedicated expand toggle to `StudyMediaPlayer` for `/study`
only, growing the player itself to fill the viewport, while leaving
`CardPreviewModal` and its own expand button completely untouched - the two
features intentionally don't share an implementation, per the build-plan's
own note that `/study`'s layout needs its own expand design.

## In scope

- An expand/collapse icon button on `StudyMediaPlayer`'s player frame,
  gated behind a new `allowExpand` prop (default `false`/unset) so it only
  renders where a parent opts in.
- `/study` passes `allowExpand="true"`; `CardPreviewModal` does not pass it
  at all, so Preview keeps zero expand affordance of its own inside
  `StudyMediaPlayer` (it already has its own, separate expand button on the
  modal panel from feature 20 - unrelated code path, untouched here).
- When expanded, the player frame becomes a fixed, full-viewport overlay
  (above the persistent nav bar), scaled to fill the screen while
  preserving its 16:9 aspect ratio; the play/scrub/time/volume controls
  stay visible underneath it, same as today, just larger.
- Collapsing: click the same button again, or press Escape.
- While expanded, `/study`'s side panel (song info + pass/fail buttons) is
  visually covered but stays mounted, so pass/fail still works via the
  existing `ArrowLeft`/`ArrowRight` hotkeys (`StudyAnswerControls` listens
  on `window`, not scoped to visibility) - no dedicated "exit and answer"
  step is needed.

## Out of scope

- Any change to `CardPreviewModal.vue` or its own expand button/state -
  those stay exactly as feature 20 built them.
- A keyboard hotkey for the new expand button - feature 20's equivalent
  button on Preview has none either; adding one here would be new scope the
  build-plan line didn't ask for.
- Click-outside-to-collapse. There's no separate backdrop the way a modal
  has one (the expanded player *is* the whole viewport), and a stray click
  should not fight with clicking play/pause or the scrub bar underneath it.
  Only the button itself and Escape collapse it.
- Making the expanded player collapse automatically when a new card loads
  (session advances after pass/fail) - not requested, and would fight with
  the arrow-key-while-expanded workflow this spec relies on.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add the expand toggle to `StudyMediaPlayer`, wire it on
  `/study` only**
  - `nuxt-app/app/components/study/StudyMediaPlayer.vue`:
    - Add `allowExpand?: boolean` to `defineProps`.
    - Add `const expanded = ref(false)`.
    - Add an icon button inside `.player-frame`, `v-if="allowExpand"`,
      positioned opposite the existing `.theme-badge` (top-right, same
      circular style as `CardPreviewModal`'s expand button: 36px circle,
      `var(--border)`/`var(--surface-raised)`/`var(--text)`), glyphs `⤢`
      (collapsed) / `⤡` (expanded), `aria-label` toggling
      "Expand"/"Collapse", `@click="expanded = !expanded"`. Stack it above
      the veil (`z-index` higher than the veil's implicit `0` and the
      theme badge's `2`).
    - Add a `.player-card.expanded` (or equivalent wrapper) CSS rule:
      `position: fixed; inset: 0; z-index: 60;` (above `NavBar`'s
      `z-index: 20`) with a background so nothing behind it shows through;
      keep `.player-frame` centered and capped (e.g. `max-width: 100vw;
      max-height: 90vh;`) so the `aspect-ratio: 16/9` box scales up without
      distortion; `.player-controls` stays below it, in flow.
    - Extend the existing `onKeydown` window listener (currently just the
      `s` play/pause hotkey) to also collapse on `Escape` when
      `expanded.value` is true.
  - `nuxt-app/app/pages/study/index.vue`: add `allow-expand="true"` to the
    existing `<StudyMediaPlayer>` usage. No other change on this page -
    `StudyInfoPanel`/`StudyAnswerControls` need no edits, since they stay
    mounted (just visually covered) and their pass/fail hotkeys are
    already window-scoped.

  *Done when:* on `/study`, an expand button appears on the player;
  clicking it grows the player to fill the viewport (nav bar and side
  panel visually covered); clicking again, or pressing Escape, returns to
  the normal two-column layout; while expanded, pressing `ArrowLeft` /
  `ArrowRight` still records a fail/pass and advances to the next card
  (confirms `StudyAnswerControls` still functions though covered);
  previewing the same card from `/cards` shows no expand button on the
  player inside `CardPreviewModal` (confirms `allowExpand` isn't passed
  there and Preview's own separate expand button, if used, still works
  unrelated to this change).

## Files / areas

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` (prop, state,
  button, CSS, keydown extension - the only file with real logic changes).
- `nuxt-app/app/pages/study/index.vue` (one-line prop pass-through).

## Data / contracts

- None. Client-side UI state only, not persisted (matches Study's other
  session-only toggles, e.g. Hide Video/Hide Info/Start at random times -
  unlike feature 21's volume slider, this one resets every session since
  the build-plan line doesn't ask for persistence and there's no natural
  "sticky" expectation for a full-screen toggle).

## Testing

- No test runner is configured in `AGENTS.md`, and this is UI-only (a prop,
  a ref, a CSS class, a keydown branch) - rides on browser/manual evidence,
  not a unit test, consistent with features 21 and 22.
- Manual check: open `/study` with a card due, click the new expand button,
  confirm the player fills the viewport and the nav bar/side panel are
  covered; press `ArrowLeft` while expanded and confirm the session
  advances to the next card (fail recorded) even though the buttons aren't
  visible; expand again and press Escape to confirm it collapses; open a
  card's Preview from `/cards` and confirm no expand button appears on the
  player itself (only Preview's own, separate expand button on the modal
  chrome, from feature 20, is present).

## Notes for the AI

- `allowExpand` is the only thing that separates `/study`'s behavior from
  `CardPreviewModal`'s - don't touch `CardPreviewModal.vue` at all; it
  already has its own unrelated `expanded` ref and expand button on the
  modal panel, not the player.
- The veil (`Paused`/`Listening...`/error) and its z-index-2 `.theme-badge`
  sibling already exist in `.player-frame` - the new button needs to stack
  above both, not fight them for click targets.
- `StudyAnswerControls`' keydown listener is already on `window`
  (`onMounted(() => window.addEventListener("keydown", onKeydown))`), so no
  change is needed there for arrow keys to keep working while the player
  visually covers it - verify this behavior rather than re-implementing it.
- Reuse the same expand/collapse glyphs (`⤢`/`⤡`) and `aria-label` pattern
  `CardPreviewModal.vue` already uses, for visual/interaction consistency,
  even though the implementations stay separate.
