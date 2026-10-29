# Fix: Kanji page fits the desktop viewport

**Type:** Fix
**Status:** verified (measure at three sizes; screenshot)

## The problem

On desktop `/kanji` scrolls. `.kanji-page` in `nuxt-app/app/pages/kanji/index.vue`
has no height bound (it sits in `.app-content`, `height: 100vh`), the 140px
kanji, the revealed details, and the background clip (`StudyMediaPlayer`, which
sizes itself 16:9 off its column width) together exceed the window. The clip
beside the card reads too big.

## The fix

Make the page fill the window above the 820px narrow breakpoint, with no page
scroll:

- `.kanji-page`: `flex: 1; min-height: 0; overflow: hidden` (desktop only).
- `.kanji-stage`: `flex: 1; min-height: 0`, grid row `minmax(0, 1fr)`, so both
  columns are capped to the remaining height.
- `.kanji-clip`: cap the player to the stage height (the player's frame is
  height-capped by its container) and give the column less width than the card.
- `.kanji-card`: `max-height: 100%`, with the revealed content scrolling inside
  the card (`overflow-y: auto`) rather than the page, and the kanji size scaled
  down on short windows (`clamp` on `.kanji-char`, a `max-height` media query).
- Below 1100px (stacked layout) and narrow windows the page may scroll as today.

Must not break: the player, Skip clip, hotkeys, narrow-window layout.

## Build steps

- [x] **Step 1 - Fit the page** - CSS only in `kanji/index.vue`, as above. *Done
  when:* at 1440x800, 1280x720 and 1920x1080 the document does not scroll before
  or after Reveal (`bun run measure /kanji --size 1280x720 --select
  .kanji-page,.kanji-card,.kanji-clip` shows `.kanji-page` inside the viewport),
  the clip is visibly smaller than the card column, a long reveal scrolls inside
  the card, and below 1100px it still stacks.

## Verify

Open `/kanji` with a due kanji on a desktop window: nothing scrolls the page,
the clip fits beside the card, Reveal keeps it fitting.
