# Feature: Compact, resizable Cards table

**From build-plan:** feature 98
**Status:** verified

## Goal

On smaller screens the Cards table cuts off the text that matters: fixed Anime
(200px), Sources (140px) and Due (92px) columns leave the Song column only the
remainder, so a song and artist show as "H.." and "C..". Drop Sources and Due
from the table (the inspector rail already shows both), keep the cover, the
song with its artist stacked beneath it, and the anime, and let the user drag
the divider between Song and Anime to give one more room at the other's cost.

## Design reference

The user's screenshot of the current table (song and artist clipped to one
letter, Sources and Due taking the width). Saved at
`blueprint/reference/cards-table-cutoff.png`.

## In scope

- `CardTable.vue` shows: optional select checkbox, cover, Song (title, with the
  artist stacked under it, plus the existing Suspended badge), and Anime (title
  and OP/ED slot).
- Remove the Sources and Due columns and their header cells. Sources and Due
  remain in `CardInspector.vue` unchanged (Due tile, Sources block).
- Remove the `showDue` prop, and its `show-due` use in `/decks`. The deck
  page's `showSchedule` stays, because the inspector still uses it.
- Remove the 820px rule that hid the Anime column; both text columns show at
  every width.
- One draggable divider between the Song and Anime header cells. Dragging moves
  width from one column to the other. Each column keeps a minimum so neither
  can be dragged away. Double-click resets to the default split.
- The split is remembered in the browser (`localStorage`
  `gaqSrs:cardColumns`) and shared by `/cards` and `/decks`.
- Full text on hover (`title`) for the song, artist, and anime cells, since they
  stay single-line with an ellipsis.

## Out of scope

- A separate Artist column, or showing/hiding columns (decided at intake).
- Changing the inspector rail, its resizer, or what it shows.
- Any server, data, or route change.
- Sorting by column.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Split math** - `app/utils/cardColumns.ts` with its Vitest test
  `cardColumns.test.ts`: `DEFAULT_SONG_SHARE`, `clampSongShare(share, areaWidth)`
  (keeps both columns at least `MIN_TEXT_COLUMN_PX`, falls back to the default
  for a non-finite value, and yields the default when the area is too narrow for
  two minimums), `songShareFromPointer(pointerX, areaLeft, areaWidth)`, and
  `parseStoredSongShare(raw)` (null, empty, non-numeric, or out of range gives
  the default). *Done when:* `bun run test` passes with cases for each function,
  including the narrow-area and bad-stored-value cases.
- [x] **Step 2 - Slim the table** - in `CardTable.vue` remove the Sources and
  Due columns, the `showDue` prop, the 820px column hiding, and the unused
  `compactSourceBadges`/`dueLabel`/`isDueNow` imports and their styles; the
  grid becomes cover plus two `fr` columns at the default split; add `title`
  attributes. Remove `show-due` from `/decks`. *Done when:* `/cards` and
  `/decks` rows show only cover, song over artist, and anime; selecting a row
  still shows Due and Sources in the inspector; the Suspended badge still shows;
  `bun run build` passes; a 640px-wide window no longer clips the song to one
  letter (checked with `bun run measure /cards --size 640x700`).
- [x] **Step 3 - Draggable divider** - `app/composables/useCardColumns.ts`
  mirroring `useResizablePane.ts` (pointer capture, persist on release,
  `localStorage` wrapped in try/catch, re-clamp on window resize, reset on
  double-click), and a handle in `CardTable.vue`'s header between Song and
  Anime driving the grid's `fr` values through a CSS variable (no inline style
  literals other than that variable, as the pages already do for
  `--inspector-width`). The handle has a hit area wider than its visible line and
  `touch-action: none`. *Done when:* dragging the divider grows one column and
  shrinks the other and stops at the minimums; double-click restores the
  default; the split survives a reload and is the same on `/cards` and
  `/decks`; with storage blocked the table still renders at the default.
- [x] **Step 4 - Evidence pass** - measure both pages at 1400, 820 and 480px
  wide with the default and a dragged split, and confirm the checkbox column
  and selection bar are unaffected. *Done when:* `bun run measure` output shows
  the song and anime cells wider than before at every size, with no horizontal
  scroll, and `bun run test` and `bun run build` are green.

## Files / areas

- `nuxt-app/app/components/card/CardTable.vue` (columns, header, handle)
- `nuxt-app/app/pages/decks/index.vue` (drop `show-due`)
- New: `nuxt-app/app/utils/cardColumns.ts` and `cardColumns.test.ts`
- New: `nuxt-app/app/composables/useCardColumns.ts`
- Untouched: `CardInspector.vue`, `pages/cards/index.vue`, `useResizablePane.ts`

## Data / contracts

- None on the server. `CardTable`'s `CardRow` loses no field the other
  components read; `nextReviewAt` and the four source fields stay in the type
  only if the page still passes them (they do, the inspector shares the objects),
  so do not tighten the prop type in this feature.
- Stored value: `gaqSrs:cardColumns` holds the Song share as a number between 0
  and 1. An invalid value is ignored, never an error.

## Testing

- `cardColumns.ts` is in-scope pure logic: ships with `cardColumns.test.ts`
  (step 1). `bun run test` runs it.
- The table and composable are UI: verified in the running app with
  `bun run measure` (geometry at several widths) and a manual drag, plus
  `bun run build`. No new browser dependency.

## Notes for the AI

- Follow `useResizablePane.ts` and `paneWidth.ts` for structure and style.
- Styles use `var(--token)` in the scoped block; no hard-coded colors, no inline
  styles beyond the one CSS variable.
- Header and row grids must share one `grid-template-columns` string, as the
  existing comment in `CardTable.vue` says. The selectable variant keeps its
  22px checkbox column outside the table grid.
- Don't add features beyond this spec. No em dashes in comments or docs.
