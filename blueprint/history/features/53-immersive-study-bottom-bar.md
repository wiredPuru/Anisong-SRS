# Feature: Immersive study mode: bottom bar layout

**From build-plan:** feature 53
**Status:** verified

## Goal

Replace today's immersive-mode overlay - card info and Fail/Pass floated
directly on top of the playing video (feature 31) - with a layout where the
video stays completely clean while playing, and every control (playback,
language toggles, card info, Fail/Pass) lives in a horizontal bar underneath
it instead. Resolves the open Study fullscreen/ambient-overlay decision left
by build 50. Applies wherever immersive mode already applies: `/study` and
`CardPreviewModal`.

## Design reference

`blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`,
the `#2b "Bottom bar"` candidate (`data-screen-label="2b Study expanded"`,
around line 86) - video full-width and clean except a small `OP1` theme tag
top-left and a collapse icon top-right; a bar underneath in two rows: row 1
is playback (play/pause, elapsed time, scrubber, remaining time, volume),
row 2 is language toggle + title/romaji/native, then song/artist/learning
info, then Fail/Pass right-aligned. See the folder's `README.md` for the
candidate's rationale versus `#1b`/`#2a`.

**Token substitution (explicit, approved 2026-09-03):** the mockup uses the
Nocturne design system (`--color-bg #161826`, purple mono-accent
`--color-accent #9184d9`, Inter font, 8px radius). Build this with the app's
own shipped Akiba Neon tokens instead - `--bg`, `--surface`,
`--surface-raised`, `--border`, `--text`, `--muted`, `--faint`, `--accent`
(#ff3e88 pink), `--accent-secondary` (#34e7e4 cyan), `--radius`/`--radius-sm`
(4-6px), `--font-display` (RocknRoll One) / `--font-sans` (Zen Kaku Gothic
New) - all in `nuxt-app/app/assets/css/main.css`. The mockup's Fail/Pass
colors (`#ff5470`/`#46e39b`, outline-not-fill) already match this app's own
`--fail`/`--pass` tokens - use those directly rather than the mockup's literal
hex values.

## In scope

- Restructuring `StudyMediaPlayer.vue`'s immersive layout (`immersive` prop
  true) so `.player-frame` becomes a flex column: the video/record/visualizer
  area on top (unchanged internally - still shows a clean video, or the
  feature 44/45 spinning cover-art record for audio-only cards, with only the
  existing small theme-badge and expand/collapse button in the corners), and
  a new bar area underneath it.
- Moving the existing playback controls (`play-btn`, `scrub`, elapsed/
  remaining time, `volume-control`) - today absolutely positioned over the
  bottom edge of the video in both modes - into the new bar's first row when
  `immersive` is true. Non-immersive playback controls are unchanged: still
  overlaid on the video exactly as today (out of scope, see below).
- Moving the `#immersive` slot's mount point from floating absolutely over
  the video into the new bar's second row, as normal flow content (not
  `position: absolute`).
- Reworking `StudyInfoPanel.vue`'s existing immersive/`overlay` styling
  (currently large `cqw`-scaled text with a text-shadow, designed to float
  legibly over video) into a compact horizontal layout matching the mockup's
  row 2: language toggle segment + title block, then song/artist/theme/
  learning info groups, sized for a fixed-height bar rather than floating
  text. The existing `immersive`/`overlay` prop wiring is reused; only the
  CSS behind it changes. No prop rename.
- Reworking `study/index.vue`'s immersive slot markup: replacing the current
  two floating divs (`.info-slot`, `.answer-slot`) with one bar row
  containing `StudyInfoPanel` (bar mode), the existing "Previous" button
  (feature 51), and `StudyAnswerControls` (Fail/Pass) - all in normal flow,
  right-aligned per the mockup. No change to the button components
  themselves, their hotkeys, or `submitReview`/`openPreviousCard` logic -
  placement only.
- Reworking `CardPreviewModal.vue`'s immersive slot markup the same way,
  minus the Previous button and `StudyAnswerControls` (Preview has never had
  those - matches today).
- Correcting `.player-card.expanded .player-frame`'s sizing so the video area
  keeps its ~16:9 target size with the new bar's height added underneath,
  instead of the bar eating into the space the current `min(90%, 90vh*16/9)`
  rule assumes is all video. Verify with `bun run measure` (this project's
  real-geometry tool - see `AGENTS.md`), not just a screenshot.
- The bar picks up the same `ambient-glass` frosted treatment as the rest of
  `.player-frame`'s chrome when ambient mode is on (feature 24's existing
  rule - shared UI chrome goes glass automatically with ambient mode; the
  bar is new chrome, so it should follow the same rule already applied to
  everything else in the frame, not be special-cased out of it).
- The "Learning" streak-required popover (`StudyInfoPanel`'s existing
  `streak-control-open-change` mechanism, currently given overflow room via
  `.info-slot-elevated`) gets an equivalent affordance in the new bar so it
  isn't clipped - opening upward, since the bar sits at the bottom of the
  frame.
- Basic narrow-viewport (<820px) safety for the new bar - wraps or
  horizontally scrolls its content rather than overflowing or clipping,
  consistent with feature 50h's existing 820px breakpoint convention. Not a
  bespoke narrow-mode redesign (no mockup exists for one).

## Out of scope

- **Non-immersive layout.** `/study`'s default two-column layout (video +
  side `StudyInfoPanel`) is unchanged, per `project-plan.md` §7's existing
  "unchanged by build 50" note - this feature only touches the `immersive`
  path. Its overlaid playback-controls bar stays exactly as today.
- **The header display-toggle icon strip** (`StudyDisplayToggles.vue` -
  Hide Video/Cover/Info, Auto Reveal, Random Start, Ambient, Audio-only).
  Already unaffected by immersive mode today and stays that way.
- **Auto Reveal's countdown pill** (feature 46). Stays centered over the
  video, replacing the "Listening.../Paused" text while counting down,
  exactly as today - it's a transient state indicator, not permanent chrome,
  so it doesn't conflict with this feature's "keep the video clean of
  standing UI" goal.
- **Bringing in Nocturne's tokens, fonts, or 8px radius.** Explicit decision
  above: reskin to Akiba Neon, don't introduce a second design system.
- **Any behavior change** to Pass/Fail submission, the Leitner queue,
  feature 51's session history, feature 52's session log, volume
  persistence (feature 21), the ambient glow (feature 14), or the cover-art
  record/visualizer (feature 44/45). Placement only.
- **A pixel-perfect narrow-viewport bar redesign.** Covered above as basic
  safety only.
- **Server or data changes.** Purely a client-side layout/styling feature -
  no schema, route, or type changes.

## Build steps

- [x] **Step 1 - Bottom-bar immersive layout** - restructured
  `StudyMediaPlayer.vue` (flex-column frame, playback controls + `#immersive`
  slot moved into a new below-video bar, corrected expanded-frame sizing) and
  `StudyInfoPanel.vue` (compact horizontal bar-mode CSS replacing the
  floating-overlay CSS), then rewired `study/index.vue`'s and
  `CardPreviewModal.vue`'s immersive slot markup into that bar (info +
  Previous + Fail/Pass on `/study`; info only on Preview).
- [x] **Step 2 - Streak popover + narrow-viewport polish** - gave the
  "Learning" streak-required popover room to open without landing under the
  nav rail, and fixed the bar's language-toggle/Learning row so it wraps
  instead of overflowing horizontally below 820px.

## Files / areas

- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - new `.video-area`
  wrapper (everything that used to be `.player-frame`'s own content: badge,
  expand button, video/audio, record, visualizer, veils, and - non-immersive
  only - the overlaid playback controls); a new `#video-overlay` slot inside
  it so the Auto Reveal countdown keeps centering on the video, not the bar;
  a new `.immersive-bar` (immersive only) holding a second playback-controls
  row plus the existing `#immersive` slot; a `.has-bar` class (bound to
  `immersive`) that frees `.player-frame`'s height from its 16:9 lock and
  moves that ratio onto `.video-area` (`flex: 1 1 auto`, shrinkable) instead,
  so the frame's total height adapts to the bar's real content instead of
  the bar cutting into a fixed-16:9 box.
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - `.info-card.overlay`
  rewritten from floating cqw-scaled text into a compact horizontal row;
  "Learning" moved into its own full-width, wrapping sub-row
  (`justify-content: space-between` against the language toggles) rather
  than staying grouped with them at the bar's left edge.
- `nuxt-app/app/pages/study/index.vue` - `.info-slot`/`.answer-slot`
  replaced by one `.bar-row` (normal flow) containing `StudyInfoPanel` and a
  `.bar-answer-group` (Previous + Fail/Pass, `margin-left: auto`); countdown
  moved into the new `#video-overlay` slot.
- `nuxt-app/app/components/card/CardPreviewModal.vue` - same `.bar-row`
  treatment, info only.
- `nuxt-app/app/assets/css/main.css` - added `.immersive-bar` to the
  ambient-glass selector list (feature 24's existing rule).

## Data / contracts

None. Purely a client-side layout/styling change; no schema, API, or stored
shape was added, removed, or altered.

## Verify

- `bun run build` passed clean after each step and again as this skill's own
  final safety pass.
- Live browser verification via `bun run measure` (headless Chrome over CDP,
  this project's own pattern, no Playwright) at 1920x1000 and 390x844,
  confirming real box geometry (no clipping, no scroll) both before and
  after each fix, not just a screenshot: `.player-frame`, `.video-area`, and
  `.immersive-bar` boxes measured directly.
- `CardPreviewModal`'s immersive bar verified the same way via `/decks`'
  Preview action.
- **Two real bugs found by that live verification, not caught by static
  review**, both fixed within Step 2:
  1. The "Learning" streak popover, grouped with the language toggles near
     the bar's left edge, opened underneath the nav rail. Fixed by giving
     that row `justify-content: space-between` so Learning sits at the
     bar's right edge instead, confirmed via a scripted click-and-measure
     check (popover box fully on-screen, no rail overlap).
  2. The first `.has-bar` sizing fix (moving the 16:9 ratio onto
     `.video-area`) broke the *desktop* case - the video ballooned to fill
     the entire frame height, pushing the bar off-screen - until
     `.video-area` was given `flex: 1 1 auto` (shrinkable) instead of a
     fixed size. Re-verified at both 1920x1000 and 390x844 after the fix.
- Dev server log checked for new console/hydration errors: none beyond the
  pre-existing `/study` hydration mismatch feature 51 already isolated as
  unrelated.
- No test runner configured (`AGENTS.md` has no `test` command) - this is
  UI/integration work, verified by browser evidence and build only, per the
  Testing gate in `coding-standards.md`.

## Notes

Deviated from the mockup's exact sub-grouping in one place: "Learning" sits
at the far right of its own full-width row rather than inline next to
Fail/Pass as in the `#2b` mockup - a CSS-only fix (see Verify above) chosen
to avoid touching template markup shared with the non-immersive side panel.
