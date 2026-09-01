# Feature: Auto Reveal modes + settings popup

**From build-plan:** feature 46
**Status:** verified

## Goal

Replace Auto Reveal's single on/off toggle with a choice of what it
targets - Video, Info, or Both - and move that choice (plus the interval)
into a small settings popup instead of extra buttons crowding the
display-toggles row. Turning on a mode forces its target Hide toggle(s) on,
both immediately and again at the start of every new card, so the study
screen honestly reflects what Auto Reveal is doing rather than hiding it
behind an invisible OR-condition.

## In scope

- A new `AutoRevealMode` union (`"off" | "video" | "info" | "both"`)
  replacing the current `autoReveal: boolean` in `study/index.vue`,
  persisted via `localStorage` under a new key `gaqSrs:autoRevealMode`
  (replaces `gaqSrs:autoReveal` - the old boolean key is simply abandoned,
  no migration, matching this app's existing no-migration convention for
  session/preference keys).
- `autoRevealSeconds` is unchanged (same key, same 1-30s clamp).
- Two derived computeds: `autoRevealTargetsVisual` (`mode === "video" ||
  mode === "both"`) and `autoRevealTargetsInfo` (`mode === "info" || mode
  === "both"`). "Visual" deliberately covers **both** Hide Video and Hide
  Cover, not just Hide Video - feature 44/45 already treats them as the
  same slot (whichever applies to the current card's type), and the
  already-merged auto-reveal fix's `(hideVideo || autoReveal)` /
  `(hideCover || autoReveal)` bindings already coupled them this way. The
  "Auto Reveal Video" label reflects how the user names it, not a
  restriction to literal video-capable cards only.
- **Forcing on activation/mode change:** a watcher on the mode forces the
  newly-targeted toggle(s) to `true` immediately, and reverts whichever
  toggle(s) *were* targeted by the previous mode back to `false` when they
  stop being targeted (covers both "turn Auto Reveal off" and "switch
  mode," e.g. Video -> Info, in one rule). A toggle never targeted by
  either the old or new mode is left completely untouched - the user's own
  manual state for it persists normally.
- **Forcing on every new card:** whichever toggle(s) the *current* mode
  targets are re-forced to `true` at the start of every new card
  presentation, overriding any manual Hide Video/Hide Info/Hide Cover
  change the user made mid-card via button or hotkey. This is separate from
  the mode-change watcher above (no mode change happens here) and only ever
  forces *on*, never off - an untargeted toggle is still never touched.
- A new `StudyAutoRevealSettingsModal.vue`, opened from a single "Auto
  Reveal" button in `StudyDisplayToggles.vue` (button shows on/off state
  via the existing `.toggle-btn.on` glow whenever mode isn't `"off"`, and
  now opens the modal instead of directly toggling). The modal itself:
  four mode buttons (Off / Video / Info / Both, same `.toggle-btn` look),
  the seconds number input (shown once a non-off mode is selected), and a
  close (`✕`) button - plus `@click.self` on its backdrop and `Escape` to
  close, matching `CardPreviewModal.vue`'s established modal pattern.
  Selecting a mode does not auto-close the modal, so the user can also set
  the interval right after.
- `StudyDisplayToggles.vue`'s prop/emit contract changes to
  `v-model:auto-reveal-mode` and `v-model:auto-reveal-seconds` (replacing
  `autoReveal`/`toggle-auto-reveal`/`update-auto-reveal-seconds`), matching
  the `v-model:immersive` convention already used on `StudyMediaPlayer`.

## Out of scope

- `CardPreviewModal` - no Hide Info/Auto Reveal UI there at all, same
  carve-out feature 38 already made.
- Any change to the pausable-countdown timer mechanics themselves (armed
  at/remaining-time tracking, pause on `playback-paused`, resume on
  `playback-started`) - reused exactly as merged, just re-scoped to
  whichever target(s) the active mode names instead of a blanket
  "auto-reveal is on."
- A hotkey for opening the new settings modal - matches Auto Reveal's
  existing no-hotkey precedent ("a session-shaping preference set via the
  toggle button, not something toggled mid-card").
- Any change to `StudyInfoPanel`'s own `:blurred` prop wiring
  (`hideInfo && !autoRevealedThisCard`) - unchanged; it already does the
  right thing once `hideInfo` itself is being forced correctly upstream.
- Migrating or reading the old `gaqSrs:autoReveal` boolean key - abandoned,
  not converted.
- Any visual indicator on the Hide Video/Hide Info/Hide Cover buttons
  themselves noting they're currently being forced by Auto Reveal (a
  tooltip change, a disabled look, etc.) - they stay exactly as clickable
  and styled as today; only their underlying boolean state is affected.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `AutoRevealMode` data model + forcing logic** - in
  `study/index.vue`: replace `autoReveal: ref(false)` with `autoRevealMode
  = ref<AutoRevealMode>("off")`, update its `localStorage` read/write block
  to the new key with mode-string validation (fall back to `"off"` on a
  missing/invalid stored value), add `autoRevealTargetsVisual`/
  `autoRevealTargetsInfo` computeds, add the mode-change watcher (force
  newly-targeted on, revert newly-untargeted off) and the new-card forcing
  (force currently-targeted on) inside the existing presentation-key reset
  watch. Update every existing `autoReveal`-reading site to the new
  computeds: `maybeStartOrResumeAutoReveal`'s guard becomes `autoRevealMode.value
  !== "off"`, both `StudyAutoRevealCountdown` `v-if`s likewise, and
  `:hide-video`/`:hide-cover` become `(hideVideo || autoRevealTargetsVisual)
  && !autoRevealedThisCard` / `(hideCover || autoRevealTargetsVisual) &&
  !autoRevealedThisCard`. Leave `StudyDisplayToggles.vue` and its existing
  single toggle button/seconds input completely untouched for this step -
  wire the page-level `autoRevealMode` through a temporary inline binding
  (e.g., the existing button's click still flips between `"off"` and
  `"both"`) purely so the logic is manually testable before Step 2 replaces
  the UI. *Done when:* clicking the existing Auto Reveal button forces Hide
  Video (on a video-capable card) or Hide Cover (on an audio-only/cover-art
  card) on immediately; playing, pausing, and resuming still behaves
  exactly as the just-merged fix; manually turning Hide Video off mid-card
  while Auto Reveal is on is overridden back to on the moment the next card
  loads; clicking the button off reverts the forced toggle back off; a
  console has no errors switching between several cards.
- [x] **Step 2 - settings modal + Info targeting** - build
  `StudyAutoRevealSettingsModal.vue` (four mode buttons, seconds input,
  close button, backdrop/Escape-to-close via `Teleport to="body"`).
  Replace `StudyDisplayToggles.vue`'s single Auto Reveal button/seconds
  label with one button that opens this modal and shows the current mode's
  on/off glow; wire `v-model:auto-reveal-mode` / `v-model:auto-reveal-seconds`
  through to `study/index.vue`, removing Step 1's temporary off/both-only
  binding. *Done when:* the display-toggles row shows a single "Auto
  Reveal" button (no separate seconds input inline); clicking it opens the
  modal with the current mode highlighted; picking Info mode forces Hide
  Info (not Hide Video/Hide Cover) on, and its own new-card/mode-change
  forcing behaves the same way Step 1 proved for Video; picking Both forces
  both; the modal closes via `✕`, backdrop click, or `Escape` without
  affecting the chosen mode.

## Files / areas

- `app/pages/study/index.vue` - `AutoRevealMode` type, ref, computeds,
  watchers, updated bindings.
- `app/components/study/StudyDisplayToggles.vue` - Auto Reveal button
  becomes a modal-opener; prop/emit contract changes to
  `auto-reveal-mode`/`v-model`.
- `app/components/study/StudyAutoRevealSettingsModal.vue` - new component.

## Data / contracts

- `type AutoRevealMode = "off" | "video" | "info" | "both";` - load-bearing
  across `study/index.vue`, `StudyDisplayToggles.vue`, and the new modal
  component. Defined inline in each (matches this codebase's existing
  convention of small local string unions like `"video" | "audio"` rather
  than a shared types file for page-local UI state).
- No server/API/schema changes - purely client-side session/preference
  state, same as the rest of `/study`'s display toggles.

## Testing

No test runner is configured for this project yet (no `test` command in
`AGENTS.md`), so this rides on manual/browser evidence:

- Verify both steps' done-whens directly on `/study`.
- Cover: Video mode on a video-capable card, Video mode on an
  audio-only/cover-art card (forces Hide Cover, not Hide Video), Info mode,
  Both mode, and Off.
- Confirm switching directly between two active modes (e.g., Video ->
  Info) reverts the no-longer-targeted toggle and forces the newly-targeted
  one, without needing to pass through Off first.
- Confirm the pause/resume countdown behavior from the merged fix is
  unaffected by this feature.
- Confirm a card with no video and no cover image at all degrades
  gracefully under any mode that targets the visual - forcing
  `hideVideo`/`hideCover` true has nothing to visibly act on, no error.
- Confirm a persisted non-off mode from a previous session (reload the
  page with Auto Reveal already set to Both) applies its forcing
  immediately on load, not just after the next manual mode change.
- Run `bun run build` as the final check (no `Verify` command is configured
  in `AGENTS.md` yet).

## Notes for the AI

- The mode-change watcher must compare *previous* mode's targets against
  the *new* mode's targets to decide what to revert - don't just force the
  new mode's targets and leave the old ones alone, or switching Video ->
  Info would leave Hide Video stuck on.
- The new-card forcing only ever sets a targeted toggle to `true`; it must
  never set an untargeted one to `false` - that reversion only belongs to
  the mode-change watcher, per the earlier fix's design questions already
  resolved (only the toggle(s) the active mode targets are touched at all).
- Reuse `AUTO_REVEAL_SECONDS_MIN`/`MAX`/`DEFAULT` and the existing
  `clampAutoRevealSeconds` unchanged - the interval's own validation isn't
  part of this feature.
- `StudyAutoRevealSettingsModal.vue` should mirror
  `CardPreviewModal.vue`'s backdrop/Escape/`Teleport` pattern closely
  rather than inventing a new modal shell - this app has exactly one modal
  convention so far and this should look like a sibling of it, not a new
  one.
