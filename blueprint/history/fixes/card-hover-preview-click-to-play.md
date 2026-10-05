# Click-to-play inspector (hover preview dropped)

**Type:** Fix

**Status:** verified

## The problem

Two things on `/cards` and `/decks` (deck detail), both of which render the shared `CardTable` and `CardInspector`:

1. **Rows are hard to tell apart.** Each row's cover is a 34x48 thumbnail (`.cover-thumb` in `CardTable.vue`). Many neighbouring rows share one anime cover (all of "Kill la Kill: GOODBYE AGAIN" looks identical at that size), so you cannot see what you are about to click while scrolling.
2. **Selecting a card starts loading it.** `CardInspector` mounts `StudyMediaPlayer` as soon as a row is selected, and that component on mount:
   - prefetches the remote clip through `/api/media/prefetch`, and the `<video>`/`<audio>` `src` hits `/api/media/stream`, which caches the whole file before answering. So merely clicking a row downloads and streams the clip.
   - runs the Auto Download setting (feature 59) and saves the clip into the library folder.

   Clicking a row to read its details should not cost bandwidth or disk. Plenty of people will click through dozens of rows.

## The fix

**1. Hover preview (`CardTable.vue`)**

- While the pointer rests on a row with a cover, show a large copy of `animeCoverImageUrl` (about 200px wide, natural aspect) in a floating layer. A row with no cover shows nothing.
- Built so it does not disturb scrolling and hovering:
  - `pointer-events: none`, so it never intercepts the pointer, a click, or wheel scrolling.
  - Short show delay (about 120ms) so sweeping the pointer down the list does not flash a preview per row; it moves to the new row instead of stacking.
  - Hidden on `scroll` of the list, on click, on mouse leave, and on `Escape`. Also shown on keyboard focus (`:focus-visible`) of a row, hidden on blur.
  - Only under `@media (hover: hover)`, so touch devices are untouched.
- Placement: fixed-position, anchored at the left edge of the row's Anime column, vertically centred on the row and clamped to the viewport. That blank-ish area never covers the hovered row's own song title or artist. The clamp is a pure helper, `app/utils/hoverPreview.ts`, with a test beside it.
- Check the stored cover URL is large enough to look sharp at 200px (AniList `large` is about 230px wide). Do not change what is stored; if it is the `medium` size, say so and stop for a decision rather than adding a re-fetch.

**2. Click-to-play inspector (`CardInspector.vue`)**

- A newly selected card shows a cover tile with a clear **Play** button (cover, slot label, and a play icon) instead of mounting `StudyMediaPlayer`. Nothing is requested for the clip until the button is pressed.
- Pressing it mounts the player and starts playback in the same click (a small optional `startOnMount` prop on `StudyMediaPlayer`, which calls the existing `playIfPaused`, so there is no second "Ready?" click). `StudyMediaPlayer`'s prefetch and Auto Download triggers are left alone: after the user opts in to playing, the user's Auto Download setting applies as before.
- The existing Download video / Download audio buttons in the inspector body stay, so a user can save the clip without ever playing it.
- Play state is per card: selecting another card returns to the Play tile, as the immersive flag already does there. Cards with no source keep today's plain cover tile.

**Must not break**

- `/study` and `CardPreviewModal` (opened by an explicit action) keep today's behaviour, including auto-start/prefetch.
- The F full-screen hotkey on Cards and Decks (commit `3e7cffa`) still works once the player is mounted. Check what it does before a Play press.
- Row selection, shift-click range checkboxes, and the selected-row styling.
- Both `/cards` and `/decks` pick this up from the shared components, with no per-page copy.

## Build steps

- [x] **1. Click-to-play inspector.** `CardInspector.vue` Play tile, `StudyMediaPlayer.vue` `startOnMount` prop, per-card reset.
  - Done when: selecting a row on `/cards` and `/decks` fires no `/api/media/prefetch` or `/api/media/stream` request and saves no file (Auto Download on); pressing Play plays the clip in one click; selecting another card shows the Play tile again.
- [x] **2. Hover preview.** `app/utils/hoverPreview.ts` (clamp) plus `hoverPreview.test.ts`, then the floating layer in `CardTable.vue`.
  - Done when: resting on a row shows a ~200px cover that follows to the next row without stacking, never blocks scrolling or clicking, disappears on scroll/click/leave, never covers the hovered row's song text, and stays on screen for the first and last visible rows.

## Verify

1. `bun run test` and `bun run build` in `nuxt-app/` pass (new clamp test included).
2. Browser, with the dev server running and Settings > Playback > Auto Download on and a default download folder set:
   - On `/cards`, open the network log, click a few remote-only rows: no `/api/media/stream` or `/api/media/prefetch` calls and no new files in the library folder. Press Play: it plays, and now the stream and the auto download run.
   - Repeat on a deck detail view (`/decks`).
   - Hover down a long run of same-cover rows (e.g. Kill la Kill: GOODBYE AGAIN): the preview tracks the row, scrolling with the wheel while hovered stays smooth, clicking still selects.
   - `bun run measure /cards --select ".hover-preview"` at 1800x900 and 1100x700 to confirm it is inside the viewport.
3. Note: `nuxt-app/app/pages/cards/index.vue` already carries an uncommitted header tweak (Browse by filters next to search, brighter chips and Import list) from earlier in this session. `/implement` will branch with it in the working tree; it is a separate change, so commit it on its own first if you want it kept out of this fix's diff.

## As built

- `CardInspector.vue`: a `playRequested` flag (reset per card) gates `StudyMediaPlayer`; the pre-play cover tile has a Play button. `StudyMediaPlayer.vue` gained an optional `startOnMount` prop that calls `playIfPaused`, so one press plays.
- `CardTable.vue` + `app/utils/hoverPreview.ts` (`placePreview`, tested): a teleported, pointer-events-none 200px cover. Placement changed from the spec: it is anchored over the row's Sources/Due cells (kept inside the row) rather than at the Anime column, because the Anime column placement covered the hovered row's own anime title in narrow windows.
- Stored cover is AniList `large` (about 230px wide), sharp enough at 200px, so nothing was re-fetched.
- Evidence: live `/cards` network log showed no `/api/media` requests on select and prefetch, stream, and auto-download only after Play; preview hid on scroll; `bun run test` 124 files / 1733 tests passed; `bun run build` succeeded. `/decks` was not browsed (same shared components).
- Also in this commit: the `/cards` header tweak made earlier in the session (Browse by filters next to the search box, import and chips made more visible, single-row header grid). It is a separate change, noted here for the record.

## Hover preview removed

The hover preview (step 2: `CardTable.vue` floating cover and `app/utils/hoverPreview.ts` with its test) was built, verified, then removed before merge at the user's request: with the inspector showing the card on click, the hover added nothing. `CardTable.vue` is unchanged from master. Only step 1 (click-to-play) and the header tweak shipped. The "As built" notes above about the hover preview, its placement and its test count describe code that is no longer in the tree.
