# Feature: Preview expand + ambient mode

**From build-plan:** feature 20
**Status:** verified

## Goal

Two small, independent additions to `CardPreviewModal`: an expand button
that grows the modal to fill the viewport (an in-page overlay, not the
native Fullscreen API), and a minimal ambient-mode toggle reusing
`StudyMediaPlayer`'s existing `ambient` prop. The ambient choice persists
across Preview opens via `localStorage` - the app's first persisted UI
preference, unlike every session-only toggle on `/study`.

## In scope

- An expand button on `CardPreviewModal` (next to the existing close
  button) that toggles the panel between its current sizing and a
  viewport-filling one (`100vw`/`100vh`, edge-to-edge, no backdrop
  padding). Pure CSS class toggle - no `requestFullscreen()`, so browser
  chrome stays visible and Escape/click-outside/the close button all keep
  working exactly as they do today.
- An ambient-mode toggle button (icon-only, not the full
  `StudyDisplayToggles` bar) that passes through to `StudyMediaPlayer`'s
  existing `ambient` prop - already correctly gated to only show a glow
  for video-backed cards, unaffected by this feature.
- The ambient choice is read from `localStorage` on mount and written on
  every toggle, defaulting to off when nothing is stored yet. It persists
  across every future Preview open (any card, any session) until changed
  again.
- Expand and ambient are independent - either can be toggled regardless of
  the other's state, and both stay available whether the modal is in view
  mode or feature 16's edit mode (both buttons sit outside that split,
  next to close).

## Out of scope

- The native Fullscreen API (`requestFullscreen()`) - deliberately not
  used, per the in-page-overlay decision made when this was scoped.
- Gating ambient on expand, or vice versa - independent toggles, not a
  prerequisite relationship.
- The full `StudyDisplayToggles` bar (Hide Video, Hide Info, Start at
  random times) - Preview gets only the ambient toggle, nothing else from
  that set.
- Persisting the *expand* state - resets to collapsed every time a Preview
  opens, same as every other non-ambient toggle in the app. Only ambient
  is asked to persist.
- `/study`'s own ambient toggle (already built, feature 14/its fix) -
  untouched.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Expand button** - add an `expanded` ref and a button next
  to the existing close button in `CardPreviewModal.vue`. Toggling it adds
  an `expanded` class to `.panel` (and removes `.backdrop`'s padding while
  expanded) via CSS: `width: 100vw; height: 100vh; max-width: 100vw;
  max-height: 100vh; border-radius: 0;` replacing the current `max-width:
  640px; max-height: 90vh`. *Done when:* in the browser, opening Preview
  and clicking Expand grows the modal to fill the browser viewport
  edge-to-edge (browser tabs/URL bar still visible - no native
  fullscreen); clicking it again (or closing and reopening Preview)
  returns to the normal size; Escape and the close button still work at
  either size. `bun run build` stays clean.

- [x] **Step 2 - Ambient toggle with localStorage persistence** - add an
  `ambientMode` ref, an icon toggle button next to Expand/close, and
  `onMounted` logic reading `localStorage.getItem("gaqSrs:previewAmbient")`
  (`"1"` -> on, anything else -> off), wrapped in `try`/`catch` (private
  browsing or a disabled `localStorage` must degrade to the default-off
  behavior, not throw). Toggling writes `"1"`/`"0"` back, same guard. Pass
  `:ambient="ambientMode"` to the existing `<StudyMediaPlayer>` usage.
  *Done when:* in the browser, toggling ambient on a video-backed card
  shows the same glow `/study` already has; closing and reopening Preview
  (even for a different card) keeps the last choice; an audio-only card
  shows no glow regardless of the toggle (existing `StudyMediaPlayer`
  gating, unchanged); reloading the whole page preserves the choice.
  `bun run build` stays clean.

## Files / areas

- `nuxt-app/app/components/card/CardPreviewModal.vue` - both buttons, the
  expand CSS, and the ambient prop wiring.

## Data / contracts

No schema or API change - entirely client-side. One new `localStorage`
key, establishing the naming convention future persisted preferences
(e.g. feature 21's volume level) should follow:

```
gaqSrs:previewAmbient -> "1" | "0"
```

## Testing

No test runner is configured yet (`AGENTS.md` Commands has no `test`
entry), and this is pure client-side UI/CSS with no logic worth
unit-testing even if a runner existed. No browser tool has been available
all session, so I'll verify what SSR HTML and `bun run build` can confirm
(the buttons and classes exist, structurally correct) and flag the actual
visual/interactive confirmation (does it really fill the viewport, does
the glow really persist across a reload) for a manual pass.

## Notes for the AI

- Guard every `localStorage` access in `try`/`catch` - never let a
  disabled or unavailable `localStorage` (private browsing, a locked-down
  environment) throw and break the modal.
- Read `localStorage` in `onMounted`, not directly in `<script setup>`'s
  top-level scope - this component can render during SSR (it's used from
  `/cards`, which is server-rendered), and `localStorage` doesn't exist on
  the server.
- Keep the `gaqSrs:` key prefix for this and any future persisted
  preference, so unrelated keys don't collide in the same origin's
  `localStorage`.
- Don't touch `StudyMediaPlayer.vue` itself - its `ambient` prop and
  gating logic (video-only, via `quizType`) already do exactly what this
  feature needs.
