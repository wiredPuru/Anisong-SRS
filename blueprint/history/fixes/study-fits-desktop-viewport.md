# Fix: Study fits every desktop viewport

**Type:** Fix

**Status:** verified

### The problem

On `/study`, some controls are off-screen at ordinary desktop sizes and the
page only works if you scroll the side pane. The user reported this on a
1080p monitor. Reproduced with `bun run measure` (Kai theme, manual mode):

| Viewport (CSS px) | What it stands for | Result |
|---|---|---|
| 1920x960 | 1080p at 100%, minus browser chrome | Fits |
| 1536x730 | 1080p at 125% OS scaling, or 125% browser zoom | Reveal button half cut off, hotkey legend hidden, `.side` scrolls |
| 1280x650 | 1080p at 150%, or a small laptop | Header wraps to 2 rows (105px), Reveal and legend fully hidden |

Causes, from measurement:

- `.study-grid` is `1fr 480px`. The player pane shrinks with the window, but
  the side column always stays 480px wide.
- `.side` is one scrolling column. The info panel inside it is a fixed
  ~587px tall at every size, so the answer controls (Edit card, Reveal /
  Pass-Fail, hotkey legend) below it are the first thing to leave the
  viewport.
- `.study-header` wraps once the toggle strip runs out of width, taking
  height from both panes.
- The user's screenshot (Safari, about 1920x1000, Typed Answers result
  showing) added two more: the page scrolled sideways about 100px, clipping
  the rail, because the hidden Filters and Session log tooltips were centred
  under the header's last buttons and hung past the window edge; and the
  quiz result's "ANSWER REVEALED" banner broke mid-word ("REVEALE / D").

Browser zoom and OS scaling shrink the CSS viewport the same way, so fixing
the small-viewport case also fixes zoom.

### The fix

Make `/study`'s desktop layout (above the existing 820px stacking breakpoint)
fit the viewport with no page or pane scrolling for the controls you need to
answer, at any desktop size from about 1280x650 up:

1. **Controls always visible.** Split `.side` into a scrolling info region
   (`flex: 1; min-height: 0; overflow-y: auto`) and a pinned action region
   (`flex: none`) holding Edit card, the answer controls, and the hotkey
   legend. If anything is short on room, the info panel scrolls; Reveal and
   Pass/Fail never do.
2. **Side column scales.** Replace the fixed `480px` track with a clamped one
   (about `clamp(340px, 28vw, 480px)`, tuned by measurement), and tighten
   `.side`'s padding and gap on short viewports (`max-height` media query or
   `clamp()` against `vh`), so the player and info keep roughly today's
   proportions instead of the player alone shrinking.
3. **Header stays one row** at 1280px and wider. Let the toggle strip
   compact (tighter padding/gap, smaller labels) before it wraps. Wrapping is
   still allowed below that.

Must not break:

- The <=820px stacked tablet/mobile layout, where panes stack and the page
  scrolls. That is expected and stays as is.
- Typed Answers mode: the answer stack over the player, the quiz result panel,
  and the suggestion dropdowns must still fit inside the frame.
- Hide Info blur, the Auto Reveal countdown centred over the info panel, the
  2600px+ ultrawide cap (feature 57), and `CardPreviewModal`, which reuses
  `StudyMediaPlayer`/`StudyInfoPanel` but not `/study`'s layout.
- Theme tokens only, no hard-coded colors or sizes outside `main.css`
  conventions.

### Build steps

- [x] **Step 1 - Pin the answer controls.** Split `.side` in
  `app/pages/study/index.vue` into a scrolling info region and a pinned
  action region. As built: `.side-scroll` wraps the info panel and the card
  editor (Edit card stays with them because it expands into a form); the
  quiz result, Previous, criterion prompt, answer controls, and legend keep
  their natural height. Also right-aligned the header's Filters and Session
  log tooltips, which removed the sideways page scroll.
  **Done when:** `bun run measure /study --size 1536x730 --size 1280x650`
  shows the answer controls and hotkey legend fully inside the viewport, in
  both manual and Typed Answers mode.
- [x] **Step 1b - Quiz result over the video.** Added mid-build at the
  user's request after step 1: the typed-answer result made the side column
  cluttered and overflow awkwardly. `StudyQuizResult` gains an `overlay`
  mode (translucent frosted card, Kai / answers / points and Continue in a
  row, no "keep listening" hint) rendered in `StudyMediaPlayer`'s `#overlay`
  slot in the answer boxes' place (`.result-stack`), capped to the frame and
  scrolling inside itself if needed. The side column no longer shows it. The
  banner's `overflow-wrap` went from `anywhere` to `break-word`.
  **Done when:** after a typed answer, the result sits over the video above
  the playback bar at 1920x1000, 1536x730, and 1280x650, with no mid-word
  banner break and no sideways page scroll.
- [x] **Step 1c - Kai anchored to the bottom bar, smaller.** Added at the
  user's request: the veil Kai (`StudyPlayerKai`, feature 84c) is a
  waist-up cutout floating mid-frame, so her body visibly ends in empty
  space, and at `clamp(56px, 17cqw, 220px)` she covers too much of the
  video. Every pose on the sticker sheet
  (`blueprint/reference/mascot-v2/kai-sheet-transparent.png`) hides that
  cut edge behind a banner, desk, or bar, and no full-body art exists, so:
  - Anchor her so her cut edge sits behind the nearest bar at the bottom of
    the frame: the answer stack while guessing, otherwise the playback bar
    (Ready?, Paused, listening, error). The speech bubble stays beside her.
    Loading already peeks over its own bar and keeps doing so.
  - Size her against the frame's height rather than a fixed clamp, about
    22-25% with a sensible min/max, tuned by screenshot.
  - Listening (clap, floating notes) sits off-centre along the bar so it
    does not cover a playing video's middle.
  - Hide the veil Kai while the typed-answer result card shows; that card
    carries its own Kai.
  - `CardPreviewModal` uses the same player and must look right too,
    including its expanded mode (sizes are in `cqw`/container units there).
  **Done when:** screenshots at 1920x1000, 1536x730, and 1280x650 show Kai
  with no floating cut edge in each mood (ready, paused, listening, guess,
  error; loading unchanged), noticeably smaller than before, never
  overlapping the answer boxes, playback bar, or result card, plus one
  Preview modal screenshot.
  As built: `StudyPlayerKai`'s non-loading moods are absolutely positioned at
  the veil's `--kai-bottom`, sinking `--kai-sink` (a fifth of `--kai-height`,
  `clamp(52px, 12cqw, 160px)`) behind the playback bar, or behind the answer
  boxes via `--guess-inset` while guessing (hidden until measured). Listening
  and error sit at 5% from the left. The page hides the idle Kai while the
  result card shows. Listening and error were not screenshotted: listening
  needs an audio card with no cover and error a failing clip, and advancing
  to one would have graded a real card.
- [x] **Step 2 - Scale the side column and compact on short viewports.**
  Clamp the side track and tighten vertical spacing on short viewports.
  Keep the quiz result banner from breaking mid-word as the column narrows.
  As built: the side track is `clamp(320px, 27vw, 480px)`, and a
  `(min-width: 821px) and (max-height: 860px)` query tightens `.side` and the
  info card's spacing and type sizes (scoped to `.side`, so Preview keeps its
  own). The banner was already handled in step 1b. Measured: card info fits
  unscrolled at 1920x1000, 1536x730, and 1366x768; 1280x650 still scrolls
  the info only because the header wraps there (step 3).
  **Done when:** at 1920x960, 1536x730, 1366x768, and 1280x650 nothing in
  `.side` needs scrolling except for unusually long notes, and the player
  keeps a reasonable share of the width. Before/after numbers come from one
  `measure` run with `--css`.
- [x] **Step 3 - One-row header on desktop.** Compact the header's toggle
  strip so it stays one row at 1280px and wider.
  **Done when:** `.study-header` measures its single-row height (~60px) at
  1280x650 and above, and wraps cleanly below that.
  As built: `.header-left` is `flex: 1 1 0` with a `min-content` floor
  instead of a 520px basis, and between 821px and 1500px wide the toggles,
  gaps, and padding tighten and the progress bar (which restates "N left")
  hides. Measured one row (58-59px) from 1100px up in both modes; it wraps
  to two rows at 900px.

### Verify

- `bun run measure /study --size 1920x960 --size 1536x730 --size 1366x768 --size 1280x650 --shot study.png`
  in manual mode and again with `--click-text "Typed Answers"`. Every
  screenshot shows the header, player, info, and answer controls with no
  cut-off element.
- In a real browser on the 1080p screen: zoom 100%, 125%, 150%. Everything
  stays usable and visible. At 820px wide and below, the panes stack and the
  page scrolls as before.
- Play through a card in each mode (Reveal then Pass/Fail; typed submit then
  Continue), with Hide Info and Auto Reveal on, and check nothing overlaps.
- `bun run test` and `bun run build` pass.
