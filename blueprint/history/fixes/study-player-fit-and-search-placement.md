# Fix: Study player overflows; global search outside Home

**Type:** Fix
**Status:** verified
**Branch:** `fix/study-player-fit-and-search-placement`

> The fix that came before this one (redesign contrast + collapsed player) is
> merged as `31c2a20` and archived at
> `blueprint/history/fixes/redesign-contrast-and-player.md`. Problem 1 below is
> what its own verification screenshots exposed, not a regression of it.

## The problem

Two reports, both against the `/study` screen after 50a-50c.

**1. The video player overflows and doesn't fit.** `.player-frame`
(`StudyMediaPlayer.vue`) is `aspect-ratio: 16 / 9` with no height bound, so it
is sized purely by the width its pane gives it. On a wide, short window the
derived height exceeds the pane and the frame runs off the bottom of the
viewport (visible in the report screenshot: the video is cut off by the window
edge and the play controls are unreachable). The design reference
(`blueprint/reference/akiba-neon-canvas.html`, `1a Study`, line 444) uses the
same `width:100%; aspect-ratio:16/9`, but only ever at 1440x900 with no rail
and no search strip, where the frame happens to fit. The app has to hold at any
window size.

Chain: `.study-grid` (`1fr 480px`) -> `.player-pane` (flex column, 24px) ->
`.player-card` (24px padding) -> `.player-frame`. Nothing in it caps height, so
the overflow is structural, not a stray value.

**2. The global search should not be on `/study`, and should not be anywhere
except Home.** `layouts/default.vue` renders `NavSearch` in a persistent
`.app-topbar` on every page. The reference disagrees: the global search
(`⌕ Search anime, artist, song`) appears **only** in Home's header (line 72).
`1a Study` has no search at all - its top strip is the study header alone. Every
other screen carries its own page-scoped search instead, which the app already
has: Cards' unified search (feature 49, `⌕ Filter cards` in the reference) and
Decks' per-tab filter (feature 35b, `⌕ Search decks`). So the strip is redundant
where it duplicates a page search, and wrong where the reference shows none.

Removing it also returns about 58px of height on `/study`, which helps problem 1
without being the fix for it.

## The fix

**Player fit.** Give `.player-frame` a `max-height` and let the aspect ratio
transfer that cap into its width, instead of the width driving an unbounded
height. Verified in Chrome against the real structure - `max-height: 100%` plus
`margin-inline: auto` on the frame, `min-height: 0` on `.player-card` and
`.player-pane`:

| Pane | Frame | Ratio | Fits | Centered |
|---|---|---|---|---|
| 1400x640 (the bug) | 962x542 | 1.775 | yes | yes |
| 700x900 (narrow) | 600x338 | 1.773 | yes | yes |
| 900x560 | 800x451 | 1.774 | yes | yes |

The width has to stay unset for this to work: an explicit `width: 100%` plus
`max-height` clamps the height and keeps the full width, distorting the box to
2.66 and pillarboxing the video. The frame is already block-level auto width, so
it still fills the pane whenever height is not the binding constraint.

Must not break:

- **Immersive/expanded** - `.player-card.expanded .player-frame` sets an explicit
  `width` and a height that can never exceed `0.9 * 100vh`, so the new cap never
  binds there. Check it anyway, including the `.info-slot` / `.answer-slot`
  overlay positions, which are percentages of the frame.
- **`CardPreviewModal`** - same component. If its panel has no definite height
  the percentage cap resolves to `none` and nothing changes; if it does, the
  player starts fitting the modal, which is an improvement but must be looked at.
- **The `/cards` inspector rail player** - narrow, so width-bound; should be
  unchanged.

**Search placement.** Render `.app-topbar` only on `/`, keeping today's markup
and styles. `NavSearch`'s handoffs all navigate to `/cards?q=...` or set
`pendingCardPreview` and navigate to `/cards`, so nothing about the destination
changes - only where the box is reachable from. `NavSearch` registers no global
hotkey, so no shortcut is orphaned.

`/` is still feature 15's pre-redesign hub page (50f is unbuilt), so the
conditional strip is the right holding position; 50f moves the search into the
redesigned Home header where the reference puts it.

## Build steps

### Step 1 - the player fits its pane at any window size - done

- `nuxt-app/app/layouts/default.vue`: `.app-content` gets `height: 100vh` plus
  `min-height: 0`, replacing `min-height: 100vh`, with a `max-width: 820px`
  media query putting the old growing behavior back below `/study`'s own
  stacking breakpoint.
- `nuxt-app/app/components/study/StudyMediaPlayer.vue`: `.player-frame` gets
  `max-height: 100%` and `margin-inline: auto`. Leave `width` unset.
- `nuxt-app/app/pages/study/index.vue`: `.player-pane` gets `min-height: 0` so
  it can shrink inside the grid row rather than passing its content's height
  through, plus `.player-pane :deep(.player-card) { min-height: 0 }`.
- Comment the non-obvious part: why the frame must not have an explicit width.

**Correction found while building.** The spec's original step 1 (the frame cap
plus `min-height: 0` on the card and pane) is a no-op in the real app, measured:
at 1920x700 the frame stayed 1260x708.8 with its bottom 174px below the
viewport, identical before and after. `max-height: 100%` needs an ancestor with
a definite height, and the chain has none - `.app-content` is `min-height:
100vh`, so it grows with its content and every descendant's "100%" grows with
it. Bounding `.app-content` is what makes the cap resolve; it also makes
`.side`'s existing `overflow-y: auto` engage for the first time. Verified the
other four routes still scroll normally: `.app-content` keeps `overflow:
visible`, so taller content still extends the document.

Two placement corrections came out of the same measurements:

- `min-height: 0` had to move off `.player-card` and onto the study page as a
  `:deep()` override. On the shared component it also applied inside
  `CardPreviewModal`, whose panel is a scrolling flex column: the card
  collapsed to 60.2px behind a 299.3px player.
- Bounding `.app-content` at every width shrank the stacked narrow layout's
  player from 640x360 to 340.4x191.5 at 820x700, so the bound stops at the
  820px breakpoint `.study-grid` already uses.

**Done when:** on `/study` in a window short enough to have triggered the bug,
the whole player card (frame plus its controls bar) sits inside the pane with no
page scroll and no clipping, still 16:9, horizontally centered, and immersive
(`E`) still lays out as before.

### Step 2 - global search only on Home - done

- `nuxt-app/app/layouts/default.vue`: render `.app-topbar` only on `/`.
- Update the `.app-topbar` comment, which explains a stacking context that now
  only applies on one route.

**Done when:** `/study`, `/cards`, `/decks`, `/stats` and `/settings` show no
search strip and each page's own header sits at the top of the content column;
`/` still shows it and a result still lands on `/cards` with the card selected.

## Verify

1. `bun run dev`, open `/study` in a short window (roughly 1400x700). The player
   fits; the scrub bar and volume are reachable; no vertical page scroll.
2. Resize wide-and-short, then narrow-and-tall. The frame stays 16:9 in both,
   centered, never clipped.
3. Press `E` for immersive. Info overlay, Pass/Fail bar and controls sit where
   they did before.
4. Open a card's player in the `/cards` inspector rail and in the add-candidate
   `CardPreviewModal`. Both still render correctly.
5. Visit every route: the search box appears on `/` only.
6. From `/`, search a card and pick a result - it lands on `/cards` with that
   card selected in the inspector; search an anime or artist and it lands on
   `/cards?q=...` with the add-candidate groups showing.
7. `bun run build` clean.

## What was verified

Driven in real Chrome over CDP (Playwright is not installed and was not added
mid-fix), against `bun run dev` with 163 due cards. Every frame measured
exactly 16:9 (1.778).

| Window | Frame | Fits viewport | Page scrolls |
|---|---|---|---|
| 1920x700 | 864x486 | yes | no |
| 1400x700 | 740x416.3 | yes | no |
| 1400x640 | 740x416.3 | yes | no |
| 1600x800 | 940x528.8 | yes | no |
| 900x560 | 240x135 | yes | no |
| 1280x1024 | 620x348.8 | yes | no (identical to before) |
| 820x700 | 640x360 | yes | yes (unchanged, below the breakpoint) |

The bug reproduced at 1920x700 and 1400x640 before the change: at 1920x700 the
frame was 1260x708.8 with its bottom 174px below the viewport, the scrub bar and
volume unreachable.

Must-not-break checks, all measured unchanged against reverted CSS:

- **Immersive (`E`)** - 1120x630 at 1920x700, 1024x576 at 1400x640, derived from
  the existing `0.9 * 100vh` cap. Info overlay, Pass/Fail bar and controls in
  their existing positions.
- **`CardPreviewModal`** - panel 640x630, frame 532x299.3, card 582x349.3:
  byte-identical to the reverted CSS. Reached from a deck's card row rather than
  `/cards`' add-candidate group, which needs a live AniList round-trip; same
  component and same single modal instance.
- **`/cards` inspector rail** - 399x224.4, width-bound, unchanged.
- **`/decks`, `/stats`, `/settings`** - still scroll the document normally
  (1990 / 4112 / 1719px tall), since `.app-content` keeps `overflow: visible`.

Search placement, all six routes: the strip is present on `/` only (56px,
"Search Anime or Artist"); on `/study`, `/cards`, `/decks`, `/stats` and
`/settings` each page's own `<main>` sits at `top=0`. Both handoffs driven live
from Home's box: a Cards result landed on `/cards` with `Dango Daikazoku`
selected in the inspector rail, and an Anime result landed on
`/cards?q=Hana%20Yori%20Dango`.

`bun run build` clean after each step and again in the final safety pass. No
test gate applies: the change is CSS plus one computed, and no test runner is
configured (`verification.logicTests` is `when-configured`).

## Not in scope

The reference also drops the **left rail** on `1a Study` (it is on every other
artboard), replacing it with the 歌 tile in the study header. That is a bigger
navigation change than either report asks for, so it is flagged, not built.
