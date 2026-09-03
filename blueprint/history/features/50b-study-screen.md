# Feature: Study screen

**From build-plan:** feature 50b
**Status:** verified

> Automated evidence: `bun run build` clean at every step; `/`, `/study`,
> `/cards`, `/decks`, `/stats`, `/settings` all 200; served CSS and markup
> checked per step; hex-literal and old-palette sweeps clean; component APIs
> proven unchanged by diff (0 script-line changes in `StudyDisplayToggles`, 0
> logic-line changes in `StudyMediaPlayer`, byte-identical `v-html` gating in
> `StudyInfoPanel`).
>
> Visual evidence: the six browser items listed below were **confirmed by the
> user at the `/complete` gate on 2026-09-02**. They could not be verified
> server-side (`/study`'s card layout renders client-side) and no Playwright
> is installed, so this status rests on that confirmation rather than on a
> captured artifact.

## Goal

Retheme and relay out `/study` to the Akiba Neon `1a Study` artboard: a
full-width two-pane split (player left, info rail right), a single header
toolbar that absorbs today's separate `<h1>`, scope row and display-toggles
row, and arcade-styled Pass/Fail. 50a already moved the tokens, so the colours
are largely right; this sub-feature is about **layout and control density**.

Direction 1A was chosen over 1B "Jukebox": the player + side info panel
arrangement stays, the toolbar collapses.

## Design reference

`blueprint/reference/akiba-neon-canvas.html`, artboard
`data-screen-label="1a Study"`. Open the file and search for that attribute.
The canvas is a mockup, not a component library: inline styles and literal
hex. Read values off it, then express them as tokens.

**Resolved: the rail stays on `/study`.** The artboard is
`flex-direction:column` with its own top bar and its own 歌 logo tile, unlike
every other 1a artboard (`display:flex`, rail + content). Going rail-less
would need a layout escape hatch that partly reverses 50a. Decision, taken
2026-09-02: **keep 50a's rail**, and adapt the artboard's top bar into a
study toolbar inside the content column, **dropping its duplicate logo tile**.
Immersive mode (`E`) remains the way to study distraction-free.

## In scope

- **Full-width two-pane layout.** `.study`'s `max-width: 1200px` goes; the
  grid becomes `1fr 480px` with the info rail carrying its own `--border`
  left edge and darker ground, per the artboard.
- **One header toolbar** replacing `<h1>Study</h1>` and `.scope-row`: scope
  chip, `Card N · N left · new X/Y`, a session progress bar, then the
  collapsed controls on the right.
- **Collapsing `StudyDisplayToggles`** from six text buttons into the
  artboard's segmented Video/Cover/Info control plus Auto reveal / Random
  start / Ambient pills, living in that toolbar.
- **`StudyInfoPanel` restyle**: segmented language control, RocknRoll One
  display title, labelled `SONG` / `ARTIST` / `THEME` rows, `LEARNING n/m`
  moved to the panel's top-right.
- **`StudyAnswerControls` restyle**: arcade buttons with the artboard's
  `box-shadow: 0 4px 0` lip, stacked label over hotkey hint, plus the hotkey
  legend line beneath.
- **`StudyMediaPlayer` frame + transport restyle**: bordered 16:9 frame, the
  theme-slot badge, the centred circular play overlay, and the transport bar
  with a cyan progress fill.

## Out of scope

- **Any behaviour change.** No route, endpoint, component API, prop, emit,
  hotkey, or stored shape changes. Every toggle does exactly what it does
  today; only its presentation changes. This is the plan's own wording for
  50b: features 10/44/46's toggles "change presentation, not behavior."
- **The narrow-window pass** - 50h. The existing `@media (max-width: 820px)`
  rule must keep working, but no new breakpoints here.
- **Making the scope chip a real dropdown.** The artboard draws `All decks ▾`.
  Today scope comes from `?type=&id=` set by `/decks`, and the chip is read-only
  text. A working picker needs a deck-list fetch and navigation - new
  behaviour, so the chip keeps its caret-free read-only form. Deferred.
- **`SPACE` as a play/pause alias.** The artboard prints `SPACE play/pause`;
  the app binds `S` (`StudyMediaPlayer.vue:587`). Render the app's real keys.
  Adding a binding is behaviour, and `Space` also scrolls and re-triggers
  focused buttons, so it needs its own decision. Deferred.
- **A release year on the `THEME` row.** The artboard shows `Opening 1 · 2005`.
  `Anime` has no year column (`aniListId`, `animethemesId`, `titleEnglish`,
  `titleRomaji`, `titleNative`). Render the theme slot alone; adding the
  column is a data-model change, not a retheme.
- **`CardPreviewModal`'s own layout.** It shares `StudyMediaPlayer` and
  `StudyInfoPanel`, so Steps 4 and 6 change how Preview looks. That is
  expected and must be checked, but Preview's modal shell is not redesigned
  here.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 0 - clear 50a's unverified list.** Before changing anything, run
  `bun run dev`, open `/study` with a real due card, and confirm the four
  items 50a merged without checking: the expanded and immersive player against
  `useNavHeight`'s new `0` (it still feeds `--nav-height` for `top:` and
  `100vh - var(--nav-height)`), the search dropdown drawing above page content,
  ambient mode over the darker ground, and the rail's active item. Fix what is
  broken here, as its own diff, before restyling on top of it.
  *Done when:* each of the four is confirmed working or has a recorded fix in
  this step's diff; `/study` renders a card with no console errors.

  **Outcome.** Found a wider regression than predicted: 50a set the rail to
  `z-index: 100` while every modal in the app sits at `50`, so the rail drew
  through `CardPreviewModal`, `DeckAddAnimeModal`, `CardAddArtistResults` and
  `StudyAutoRevealSettingsModal`, plus the expanded player at `60`. Added a
  `--z-chrome`/`--z-modal`/`--z-immersive` scale in `main.css` and dropped the
  rail and topbar to chrome level. Also added `--rail-width` and
  `--surface-sunken` (the token Step 1 was going to add anyway), repointed the
  expanded player from a dead `top: var(--nav-height)` to
  `left: var(--rail-width)` so it insets past the rail instead of hiding
  under it, changed its frame cap from `90vw` to `90%`, flipped
  `CardPreviewModal`'s override from `top` to `left`, and deleted the now
  callerless `useNavHeight.ts`. Ambient-over-dark-ground and the rail's
  active item were left to the user's browser; the rest is proven by build
  plus served CSS.

- [x] **Step 1 - two-pane shell + the missing ground token.** Drop `.study`'s
  `max-width: 1200px` and `<h1>Study</h1>`; make `.study-grid` `1fr 480px`
  filling the content column; give `.side` the artboard's `border-left: 1px
  solid var(--border)` and sunken ground with its own internal padding. Player
  pane centres a `16/9` box. Touch no component internals.

  Also add the missing token for `#0c0c16`. 50a left it hard-coded in five
  places (`StudyMediaPlayer.vue:896,903,971,1042`, `NavBar.vue:58`), against
  the project's "never a hard-coded colour" rule, and this step would add two
  more uses. Define one token in `main.css` and replace all five, so Steps 2
  and 6 have something to reference.
  *Done when:* `/study` fills the window beside the rail, the info rail is a
  fixed 480px with a visible left edge, the player stays 16:9 and centred, the
  existing 820px stacking rule still works, immersive mode (`E`) still fills
  the frame, `grep -rn "0c0c16" app/` returns only the `main.css` definition,
  and the rail and player look unchanged after the substitution.

- [x] **Step 1b - the non-card states.** `/study` spends real time in four
  states that are not a card: invalid scope, `Loading...`, an error, and
  `All caught up!`. They were centred in a 1200px column and now sit in a
  full-width two-pane shell. Give them a sensible home in the new layout.
  *Done when:* all four render legibly and centred in the content column, not
  stretched edge to edge or stranded in the empty left pane; the invalid-scope
  link to `/decks` still works; finishing a session shows `All caught up!`
  correctly.

- [x] **Step 2 - toolbar, left half.** Replace `.scope-row` with the
  artboard's header bar: bordered-bottom strip, scope chip, one
  `Card N · N left · new X/Y` line, and the session progress bar. The bar's
  fill is `reviewedCount / (reviewedCount + dueCount)`, guarded against a
  zero denominator. Keep the `New cards today` popover trigger and the `H`
  controls-toggle button working.
  *Done when:* the header renders as one strip; the counts match today's
  values; the progress bar advances after a pass and never divides by zero on
  the last card; the new-card-limit popover still opens and saves; `H` still
  toggles the controls.

- [x] **Step 3 - toolbar, right half.** Rewrite `StudyDisplayToggles`'s
  template and styles into the artboard's segmented `Video | Cover | Info`
  control plus `Auto reveal`, `Random start`, `Ambient` pills, and move it
  into Step 2's header row. **Labels read positive, state stays negative:**
  the segment is `on` (cyan) when `!hideVideo` / `!hideCover` / `!hideInfo`.
  Props and emits keep today's `hide-*` names and semantics exactly.
  *Done when:* the component's `defineProps`/`defineEmits` blocks are
  unchanged; clicking `Video` toggles `hideVideo` as before; `V`/`I`/`C`/`A`
  still work and the segments reflect them; Auto Reveal still opens its modal
  and its forced-hide behaviour (feature 46) still drives the segments.

- [x] **Step 4 - info panel.** Restyle `StudyInfoPanel`: language buttons
  become one segmented control, the anime title uses `--font-display` at the
  artboard's size, and Song / Artist / Theme become labelled rows
  (`11px/700`, `1.4px` tracking, `--faint`). Move the `LEARNING n/m` control
  to the panel's top-right, opposite the language control. Theme row shows
  the theme slot only.
  This is the largest step: a template restructure inside a 495-line
  component. If the diff runs past comfortable review, split it - segmented
  language control first, then the title and labelled rows, then the
  `LEARNING` relocation.
  *Done when:* the panel matches the artboard in both non-immersive and
  **immersive** mode; Hide Info still blurs it and the immersive `i` visibility
  toggle still works; the language toggles and furigana still render (including
  `v-html` only for real kuroshiro output, per F-07); the streak popover still
  opens and saves.

- [x] **Step 5 - answer controls.** Restyle `StudyAnswerControls` to the
  artboard's arcade buttons: label over hotkey hint, `--fail`/`--pass`
  borders on their dark tints, `box-shadow: 0 4px 0` lip. Add the hotkey
  legend line beneath.

  **The artboard's legend is wrong; do not copy it.** It prints
  `SPACE play/pause · R replay · H hide info`. Verified against the handlers:
  play/pause is `S`, not `Space`; **there is no replay binding at all** (no
  `"r"` case, no replay function anywhere in `study/index.vue` or the study
  components); and `H` toggles the controls row while `I` hides info. Print
  only real keys - `S` play/pause, `I` hide info, `E` immersive,
  `←`/`→` fail/pass.
  *Done when:* both buttons render with the lip; arrow keys still pass/fail;
  `:disabled` while reviewing still reads as disabled; every key named in the
  legend has a matching handler, and no key with a handler is misdescribed;
  the controls look right in immersive mode too.

- [x] **Step 6 - player frame + transport.** Restyle `StudyMediaPlayer`'s
  frame (1px `--border`, `--radius`), the theme-slot badge, the centred
  circular play overlay over its blurred backdrop, and the transport bar
  (cyan `--accent-secondary` progress fill, `--muted` volume). Do not touch
  the record, visualiser, ambient canvas, or any playback logic.
  The theme-slot badge is still driven by the existing `hideThemeBadge` prop
  (`hideInfo && !autoRevealedThisCard`); restyle it, do not rewire it.
  *Done when:* the frame matches the artboard; play/pause, scrub and volume
  all still work; the badge still hides with Hide Info; the record, visualiser
  ring and parallax tilt are unchanged on an audio-only card; ambient mode
  still shows through the frame; the failed-playback download fallback
  (feature 42) still renders; and `CardPreviewModal` on `/cards` and `/decks`
  still looks correct.

## Files / areas

- `nuxt-app/app/pages/study/index.vue` - shell and toolbar (Steps 1-3);
  template and `<style>` only.
- `nuxt-app/app/components/study/StudyDisplayToggles.vue` - template and
  styles (Step 3). Props and emits must come out unchanged.
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - template and styles
  (Step 4).
- `nuxt-app/app/components/study/StudyAnswerControls.vue` - template and
  styles (Step 5).
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - frame and transport
  styles only (Step 6), plus four hard-coded `#0c0c16` substitutions in
  Step 1. Playback, record, visualiser and ambient logic are off limits.
- `nuxt-app/app/assets/css/main.css` - one new ground token (Step 1).
- `nuxt-app/app/components/nav/NavBar.vue` - **one line**, the fifth
  `#0c0c16` substitution (Step 1). Listed so the token cleanup is not silent
  scope creep; nothing else in the rail changes in this feature.

## Data / contracts

**No schema, route, endpoint, emit or stored shape changes.** This is the
whole safety property of 50b: every component keeps its current API so
`CardPreviewModal`, which reuses `StudyMediaPlayer` and `StudyInfoPanel`,
keeps working without being opened.

**One approved exception, Step 4.** `StudyInfoPanel` gained an **optional**
`themeSlot?: string` prop so the artboard's `THEME` row can render at all -
the panel had no access to the theme slot before. Optional, so a caller that
omits it just gets no row; both `study/index.vue` call sites and both
`CardPreviewModal` call sites pass it. Approved by the user at the Step 4
review gate rather than defaulted into. No emit, route or stored shape moved.

Two existing shapes are read but not changed:

- `newCardsToday: { introduced: number; limit: number | null }` - already
  rendered by the scope row; the artboard's `new 0/5` is this. `limit: null`
  must keep rendering as `(no limit)`, not `0/null`.
- `currentCard.box` / `currentCard.streak` / `boxOneStreakRequired` - the
  artboard's `LEARNING 0/2`. Already gated on `box === 1`; keep that gate.

Measured off the `1a Study` artboard:

| Element | Value |
|---|---|
| Header strip | `12px 20px` padding, `1px` bottom border `--border`, `#0c0c16` ground |
| Progress bar | `230x6`, `--radius-pill`, `#16162a` track, `--accent` fill |
| Segmented control | `1px --border`, `--radius-sm`, `7px 12px` segments, `13px/700` |
| Segment on | `--accent-secondary` ground, `--accent-ink` text |
| Pill on | `1px --accent`, `#26101c` ground, `--accent` text |
| Split | `1fr 480px` |
| Info rail | `1px --border` left, `#0c0c16`, `26px` padding, `22px` gap |
| Display title | `--font-display`, `32px/1.15` |
| Row label | `11px/700`, `1.4px` tracking, `--faint` |
| Row value | `19px/700` |
| Answer button | `18px` padding, `--radius-sm`, `0 4px 0` lip, `20px` display face |
| Play overlay | `74px` circle, `--accent`, `0 5px 0` lip, `26px` glyph |
| Transport fill | `--accent-secondary`, `5px`, `--radius-pill` |

`#16162a` is already `--surface-raised`. `#0c0c16` has **no token** - checked;
it is hard-coded in five places today. Step 1 adds one and replaces them, so
nothing here introduces a sixth literal.

`#26101c` (the on-pill ground) and `#1e0f16` / `#0f1e18` (the answer-button
tints) are accent-tinted grounds with no token either. They are each used
once, so prefer `color-mix(in srgb, var(--accent) 12%, var(--bg))` over new
tokens; add a token only if a value ends up used more than twice.

## Testing

No test runner is configured (`AGENTS.md` declares no `test` command), and
this feature adds no logic worth unit testing beyond the progress-bar
fraction, which is one guarded division. It rides on browser and build
evidence, per the Testing gate in `coding-standards.md`.

- **`/study` needs a real due card to render at all.** Every step's evidence
  requires study data; a 200 on the route proves nothing here. That is the
  gap 50a shipped with, so Step 0 exists to close it first.
- Check **both** non-immersive and immersive after Steps 4 and 5, and after
  Step 6 check an audio-only (cover art) card as well as a video card.
- Check **`CardPreviewModal`** on `/cards` and on a deck detail row after
  Steps 4 and 6 - it reuses both components and is the most likely place for
  a regression this feature never opens.
- Re-check ambient mode and the glass surfaces after Step 6.
- `bun run build` passes at the end of each step.

## Browser verification (confirmed by the user, 2026-09-02)

These six have visual done-whens that no server-side check can reach. They
were walked and confirmed at the `/complete` gate. Kept here as the record of
what was checked, and as the regression list for 50c-50h:

1. **`/study` with a real card** (157 are due) - the two-pane split, the
   header strip reading as one line, and the progress bar advancing on a pass.
2. **Immersive (`E`), which Step 0 repaired** - the player should start at the
   rail's right edge with the rail visible and clickable beside it, not
   underneath it.
3. **Every modal against the rail** - Auto Reveal's popup on `/study`,
   Preview on `/cards`, the artist modal, a deck's add-anime modal. Step 0
   dropped the rail from `z-index: 100` to `--z-chrome: 30`; before that it
   drew through all four.
4. **`CardPreviewModal`** on `/cards` and a deck row - it shares
   `StudyMediaPlayer` and `StudyInfoPanel`, so Steps 4 and 6 changed it
   without this feature opening it. Check the labelled rows, the new Theme
   row, and immersive-in-Preview having no left gap.
5. **Ambient mode** - glass over the darker ground, and the segmented control
   frosting with the pills (`.display-toggles .seg` was added to `main.css`'s
   ambient-glass list).
6. **An audio-only card** - the record, visualiser ring and parallax tilt
   must be untouched; Step 6 was styles-only but it is the highest-value
   regression check.

## Deferred, deliberately

- **The artboard's big centre play button** ("SPACE TO PLAY", 74px, `0 5px 0`
  lip). Not built. That space is already occupied by `.veil`, whose
  Listening/Paused label features 44, 45 and 46 all interact with
  (`hideListeningLabel`, cover art, the countdown pill), and the transport
  already has a working hotkeyed play button. Adding a second control for the
  same state, over a veil that three features coordinate on, is a change worth
  making deliberately rather than as the tail of a restyle.
- **The header `⤢`.** `StudyMediaPlayer` owns expand/collapse and must, since
  in immersive mode the header sits behind the fullscreen player - a header
  copy would be unreachable exactly when it is needed.

## Notes for the AI

- **Read values off the artboard, don't invent them.** Open the canvas, find
  `data-screen-label="1a Study"`, and work from its inline styles.
- **The artboard is wrong about five things** and the app is right. Checked,
  not assumed:
  1. It draws no rail (resolved above - the rail stays).
  2. It prints `SPACE play/pause`; the app binds `S`
     (`StudyMediaPlayer.vue:587`).
  3. It prints `R replay`; **no replay binding exists anywhere**.
  4. It prints `H hide info`; `H` toggles the controls row, `I` hides info
     (`study/index.vue:386-398`).
  5. It shows a release year (`Opening 1 · 2005`); `Anime` has no year column.

  Treat the artboard as authoritative for **look**, and the running code as
  authoritative for **behaviour and labels**. Where they disagree, the code
  wins and the spec says so above.
- **Never flip a `hide*` boolean to a `show*` one.** The positive labels are
  presentation. Feature 46's Auto Reveal forces `hideVideo`/`hideCover`/
  `hideInfo` on and reverts them; inverting the state model would mean
  reworking that machinery, which is explicitly out of scope.
- `StudyMediaPlayer.vue` is 1352 lines and almost all of it is playback,
  record, visualiser and ambient logic. Step 6 should touch only frame,
  badge, play-overlay and transport styles. If a diff starts editing
  `mediaKind`, the analyser or the tilt handlers, the step has gone off course.
- `useNavHeight` returning `0` is 50a's deliberate intermediate state. If Step
  0 finds the expanded-player math broken, fix it by removing the dependency
  in `StudyMediaPlayer`, which 50a's archive already names as 50b's job - do
  not restore a fake nav height.
- Keep the existing conventions: scoped `<style>` blocks, `var(--token)`
  everywhere, never a hard-coded colour, no em dashes in comments.
- Expect `/cards`, `/decks`, `/stats`, `/settings` to still look unbalanced
  after this lands. They get their own sub-features (50c-50g).
