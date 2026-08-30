# Feature: Unify Preview's expand mode with Study's immersive overlay

**From build-plan:** feature 36
**Status:** verified

## Goal

`CardPreviewModal.vue` currently has its own separate expand mechanism (an
`expanded` ref that grows the whole modal panel to fill the viewport, video
and info stacked vertically, scrollable) that never listens for the `E`
hotkey at all - only `Escape` closes the modal. `/study` has its own,
different expand mechanism (`StudyMediaPlayer.vue`'s `allowExpand`/
`v-model:immersive`/`#immersive` slot - the info card overlaid directly on
the video, `E` to toggle, built in feature 31). Make Preview reuse that same
mechanism instead of its own, so both surfaces behave identically and share
one implementation.

## In scope

- `CardPreviewModal.vue` passes `:allow-expand="!editing"` and
  `v-model:immersive="immersive"` to its existing `<StudyMediaPlayer>` (which
  already supports this - no changes needed to `StudyMediaPlayer.vue` or
  `StudyInfoPanel.vue`), replacing its own `expanded` ref and the
  `.panel.expanded`/`.backdrop.expanded` CSS that today grows the whole
  modal.
- `E` toggles immersive in Preview (gated by the existing `isTypingTarget`
  guard, same as every other hotkey in this app), matching `/study`.
  Immersive is unavailable while `editing` is true (see Out of scope) - the
  expand button hides (`allowExpand` false) and `E` is a no-op then.
- While immersive, the existing read-only `<StudyInfoPanel>` (no Pass/Fail -
  Preview has no quiz/review state to act on) renders inside the
  `#immersive` slot, overlaid on the video - positioned with the same
  offsets/proportions `study/index.vue`'s `.info-slot` already uses (`top:
  7.36%; left: 1.1%; max-width: 55%; max-height: 67%; overflow-y: auto`), so
  it looks and behaves the same as `/study`'s own overlay. It automatically
  inherits the same proportional cqw-based scaling `StudyInfoPanel.vue`
  already applies to its `.overlay` styles, since that's the identical
  component/CSS - no new sizing work needed here.
- Escape's existing two-step behavior stays intact but now applies to
  Preview too: first press collapses immersive (`StudyMediaPlayer.vue`'s own
  existing Escape handling - unchanged), second press (now non-immersive)
  closes the modal. `CardPreviewModal.vue`'s own Escape-to-close handler is
  gated on `!immersive` so the two handlers (both listening on `window`)
  don't both fire the same keypress.
- The expand button moves from its old position (top-right of the whole
  modal, alongside Close/Ambient) to `StudyMediaPlayer.vue`'s own built-in
  position (top-right of the video itself) - this is the same place `/study`
  already puts it, and is an intentional visual change, not a bug.
  `.ambient-btn` shifts from `right: 104px` to `right: 60px` to fill the gap
  left by the removed button (two buttons in that row now, not three).
- `immersive` resets to `false` in the existing `watch(() => props.card?.id,
  ...)` handler (replacing today's `expanded.value = false` reset there),
  same trigger, same behavior.

## Out of scope

- Ambient mode's own toggle/persistence (feature 20's `gaqSrs:previewAmbient`
  mechanism, `ambientMode`/`toggleAmbient`/the ✨ button) - entirely
  untouched. It already works independently of expand/immersive and stays
  that way, same as it already differs from `/study`'s own separate ambient
  system.
- Any change to `/study`'s own behavior, or to `StudyMediaPlayer.vue`/
  `StudyInfoPanel.vue` themselves - both already support this reuse through
  their existing prop/slot contracts. `CardPreviewModal.vue` is the only
  file that changes.
- Overlaying the edit form, or the "Edit card" button, during immersive -
  editing has no overlay equivalent (matching how `/study` has no analogous
  editing concept at all). Entering edit mode is only reachable from the
  non-immersive view already (the "Edit card" button only renders there), so
  the two states can't collide through normal navigation.
- Deck-detail's own Preview button (feature 22) - it already reuses
  `CardPreviewModal` unchanged, so it inherits this change automatically;
  no separate work needed there.
- A visible "close" control reachable *while* immersive - `/study` has no
  equivalent affordance either (its own page-level controls become
  unreachable behind the fullscreen player during immersive, by the same
  z-index stacking), so Preview matching that via the two-step Escape above
  is the intended, consistent behavior, not a gap to fill.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Replace Preview's own expand mechanism with
  `StudyMediaPlayer`'s shared immersive mechanism** - in
  `CardPreviewModal.vue`: rename/repurpose the `expanded` ref to `immersive`
  (used as `v-model:immersive` on `<StudyMediaPlayer>`); pass
  `:allow-expand="!editing"`; add an `E`-key handler (guarded by
  `isTypingTarget` and `!editing`) to the existing `onKeydown`; gate the
  existing Escape-to-close branch on `!immersive`; move the existing
  `<StudyInfoPanel>` (read-only, ambient-aware) into the player's
  `#immersive` slot, wrapped in a small positioned `.info-slot` (same
  offsets as `study/index.vue`'s), rendered only while immersive - the
  existing non-immersive `<StudyInfoPanel>` + "Edit card" button block stays
  as today's fallback when not immersive and not editing; remove the old
  `expand-btn` markup and the `.panel.expanded`/`.backdrop.expanded`/
  `.expand-btn` CSS; move `.ambient-btn` to `right: 60px`. *Done when:*
  opening Preview on a card and pressing `E` overlays the info card on the
  video (matching `/study`'s immersive look, including proportional
  scaling), the expand button appears at the video's top-right corner
  instead of the modal's, `E`/the expand button do nothing while editing,
  and a normal (non-immersive) Preview open/close/edit cycle looks and
  behaves exactly as it did before this step.
- [x] **Step 2 - Fix immersive rendering as a collapsed sliver instead of
  fullscreen** - found during manual verification of Step 1: with ambient
  mode on, entering immersive showed only a thin bar (just `.panel`'s own
  padding, no video, no info) instead of the fullscreen overlay.
  `.panel.ambient-glass` sets `backdrop-filter`, which creates a new
  containing block for `position: fixed` descendants in current browsers
  (the same mechanism as `filter`) - so `StudyMediaPlayer`'s
  `.player-card.expanded` resolved its fixed positioning against `.panel`'s
  own box instead of the viewport, and since `.panel`'s other content
  collapses to ~0 height while immersive (nothing else renders in-flow
  then), the "fullscreen" player inherited that collapsed size instead.
  Confirmed via DevTools: the computed width was exactly `.panel`'s own
  `max-width` (638px), not the viewport. Added `backdrop-filter: none` (and
  `overflow: visible`, a smaller related fix for the same collapsed-`.panel`
  scenario) to a new `.panel.immersive` rule, placed after
  `.panel.ambient-glass` so it wins the tie at equal specificity. *Done
  when:* immersive renders fullscreen correctly with ambient mode both on
  and off - confirmed working.
- [x] **Step 3 - Stop reserving nav-bar space in Preview's immersive mode**
  - found during manual verification: `StudyMediaPlayer.vue`'s own
  `.player-card.expanded` reserves `top: var(--nav-height)` so `/study`'s
  persistent nav bar stays visible above its page-level immersive mode.
  Preview is a modal, not a page - `.backdrop` already covers the full
  viewport (including the nav bar) before immersive even starts, so
  reserving that space just left a visible gap at the top. Added
  `.panel :deep(.player-card.expanded) { top: 0 !important; }`, scoped to
  Preview's own usage only (`/study`'s behavior is untouched). *Done when:*
  no gap at the top of Preview's immersive view - confirmed working.

## Files / areas

- `nuxt-app/app/components/card/CardPreviewModal.vue` - the only file that
  changes. `StudyMediaPlayer.vue` and `StudyInfoPanel.vue` already support
  this through their existing props/slots.

## Data / contracts

None - purely a client-side component-wiring change, no schema or API
change.

## Testing

No test runner is configured, and this is a UI/interaction change (browser
behavior: hotkeys, overlay positioning, z-index stacking), not the kind of
pure logic the testing gate targets - rides on manual browser verification,
not unit tests. Verify by:

- Opening Preview on a card, pressing `E` - immersive overlay appears,
  looking like `/study`'s own (same position/proportions), expand button
  now at the video's top-right corner.
- Pressing `E` again (or clicking the backdrop, or clicking the player
  background) - collapses back to the normal Preview view.
- With immersive active, pressing `Escape` once collapses immersive;
  pressing it again closes the modal.
- Opening "Edit card": the expand button is gone and `E` does nothing while
  editing; canceling/saving returns to the normal state with expand
  available again.
- A card with both local and remote sources of different kinds, immersive
  active - overlay text/spacing scales the same way `/study`'s does at
  comparable frame sizes (inherited automatically, but worth a glance to
  confirm nothing about Preview's modal sizing breaks the container-query
  context).
- `bun run build` passes.

## Notes for the AI

- `StudyMediaPlayer.vue`'s `.player-card.expanded` uses `position: fixed`
  to cover the viewport, independent of whatever contains it - this already
  works correctly inside a modal (`CardPreviewModal.vue`'s `.panel`/
  `.backdrop` have no `transform`/`filter`/`perspective` that would create a
  new containing block and break that), so no structural change to `.panel`/
  `.backdrop` is needed beyond removing the now-dead `.expanded` variants.
- The `.info-slot` positioning CSS will be duplicated between
  `study/index.vue` and `CardPreviewModal.vue` (both are small,
  page/component-local `<style scoped>` blocks - Vue SFCs can't share a
  scoped rule across files without a global stylesheet class, which isn't
  this project's pattern for component-specific positioning). That's an
  accepted, minor duplication for two consumers, not something to abstract
  away in this step.
- Match existing conventions already in this file: the `isTypingTarget`
  hotkey guard, `onMounted`/`onUnmounted` listener wiring, and the
  `watch(() => props.card?.id, ...)` reset pattern.
