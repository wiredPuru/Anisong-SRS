# Feature: More options and pins

**From build-plan:** feature 127b (parent 127, Party host three-column revamp)
**Status:** verified
**Branch:** `feature/127b-party-more-options-pins`

## Goal

Finish the host revamp: one "More options" pop-up lists every host action,
toggle and settings panel by section, the host pins the ones they use most to
a grid of controls in the left column, and the right-hand settings tab strip
goes away so the right column is the current song alone.

## Design reference

- `blueprint/reference/party-host-revamp/layout-more-options.png` - the pop-up:
  titled sections of buttons, an "Edit pins" toggle, a close button, on/off
  state shown on toggles.
- `blueprint/reference/party-host-revamp/layout-main.png` - the pinned grid
  sits in the left column above the transport, ending in a "More..." button.

Match the arrangement, not the look: app tokens only, as in 127a.

## Decisions (from the plan and reference, recorded here)

- **The catalogue is the command palette's list.** `PARTY_PALETTE_COMMANDS`
  (feature 108) already holds every host action, toggle and panel with its
  state, availability and hotkey. More options and pins reuse it, and a pick
  runs through the dashboard's existing `onPick`, so the palette, the pop-up
  and the grid can never disagree.
- **Settings panels move into a dialog.** The tab strip leaves the right
  column. The same four tabs (Round, Screen, Players, New game) and their
  panels open in a Settings dialog from More options, from Shift+P panel
  jumps, and from the 1-4 hotkeys, the way the reference's "LT Settings"
  opens from More options. With no game running, the right column shows New
  game inline instead, so a fresh host is not left on an empty column.
- **Sections:** Queue, Toggles, Reveal, Playback and session, Scoreboard
  (the reference's grouping). Every palette command belongs to exactly one.
- **Pins** are palette command ids in `localStorage` (`gaqSrs:partyHostPins`),
  in pin order, at most 12, unknown ids dropped on read. Default: Reveal,
  Blur, Pixelate, Hide picture, Mute, Start 15s timer, Show scoreboard, Buzzer
  mode. Storage failures fall back to the defaults.

## In scope

- `app/utils/partyHostPins.ts`: the section map, `DEFAULT_PINS`, `parsePins`,
  `togglePin`, `moreOptionsSections`.
- Settings dialog replacing the tab strip; palette jumps and 1-4 open it.
- `PartyMoreOptions.vue` pop-up with Edit pins mode.
- `PartyPinnedControls.vue` grid plus "More..." in the left column.

## Out of scope

- Any server, command, or state change. No new host actions: the pop-up shows
  only what the palette already has, so the reference's YouTube, Characters,
  Vote Skip, Fixed queue, etc. are not added.
- Drag-to-reorder pins (pin order is the order they were pinned).
- The display and player pages.

## Build loop

Continuous Mode: each step is built, verified and checkpoint-committed on the
branch without a pause; the final packet is the review.

## Build steps

- [x] **Step 1 - Pins and sections util** - `partyHostPins.ts` with
  `MORE_OPTIONS_SECTIONS` (ordered `{ id, title }`), `commandSection(id)`,
  `moreOptionsSections()` (sections with their palette commands, in palette
  order), `DEFAULT_PINS`, `PIN_LIMIT = 12`, `parsePins(raw)` (JSON array of
  known ids, deduped, capped; anything else gives the defaults), and
  `togglePin(pins, id)` (append, or remove; refuses past the limit).
  *Done when:* `partyHostPins.test.ts` proves every palette command has exactly
  one section, the defaults are known ids, and `parsePins`/`togglePin` handle
  null, malformed JSON, non-arrays, unknown ids, duplicates, and the limit.
- [x] **Step 2 - Settings dialog** - the tab strip and tab bodies move from the
  right column into a Settings dialog (`PartyHostDialog.vue`, a shell the
  dashboard fills, reused by step 3), a dialog (Esc, backdrop, close
  button) with the same tabs and panels, always mounted and hidden with
  `v-show` so a half-built game survives. The right column shows
  `PartySongInfo` during a game and the New game panel (builder plus endless)
  inline with no game; the dialog's New game tab renders only during a game,
  so there is one builder at a time. `jumpTo` opens the dialog on the
  command's tab before scrolling; 1-4 open it on that tab; the shortcuts list
  says so. A temporary "Settings" header button opens it until step 4.
  *Done when:* no tab strip in the right column; with no game the right column
  shows New game and loading a game from it works; during a game 1-4 open the
  dialog on Round/Screen/Players/New game; Shift+P "Effects" opens it on Screen
  and flashes Effects; Esc closes it.
- [x] **Step 3 - More options pop-up** - `PartyMoreOptions.vue` (on the
  `PartyHostDialog` shell, with `usePartyHostPins()` moved up from step 4 for
  Edit pins, and a tested `commandStatus` in `partyPalette.ts` shared with the
  command bar) lists
  `moreOptionsSections()` as button rows: toggles show On/Off, unavailable
  commands are disabled with their reason as a tooltip, hotkeys show as a key
  hint. A pick goes through `onPick` (a toggle stays open and updates, an
  action or panel closes it). "Edit pins" switches clicks to pin/unpin, with
  pinned buttons marked; the limit shows a note. Esc and the close button
  close it. Opened from a header button for now.
  *Done when:* toggling Blur from the pop-up flips it and the button reads On;
  Next song runs and closes; Lightning round opens Settings on Round; in Edit
  pins, clicking marks/unmarks and nothing runs.
- [x] **Step 4 - Pinned controls** - `usePartyHostPins()` (read with
  `parsePins` on mount, write on change, try/catch storage) shared by the
  pop-up and `PartyPinnedControls.vue`, a wrapped grid of the pinned commands
  between the queue and the transport, same state/disabled rules, ending in
  "More..." which opens the pop-up. The temporary header buttons go; Settings
  is reached from More options.
  *Done when:* the default pins show in the left column at 1920x1080 with no
  page scroll; pinning Lobby music in Edit pins adds it to the grid; after a
  reload the grid keeps it; unpinning removes it; with storage blocked the
  defaults show.

## As built

- The Settings dialog and More options share one shell, `PartyHostDialog.vue`
  (backdrop, title, actions slot, close, Esc, `v-show`); the dashboard fills
  Settings with the same tab markup it had in the column.
- `commandStatus` (`partyPalette.ts`, tested) gives every surface the same
  On/Off and disabled reason; the command bar uses it too.
- From More options or a pinned control, a toggle only flips (More options
  stays open); actions run and close it; panels close it and open Settings on
  their tab. From Shift+P, picks still scroll to their control as before.
- To make room for the pinned grid at 1920x1080, the transport's three option
  checkboxes now share one line with short labels (Random start, Auto-next,
  Buzzer mode) and their full wording as tooltips. With a display connected
  the queue then shows its Up next box plus about 3.5 rows.
- Blocked storage was not simulated in a browser; the composable wraps every
  `localStorage` call in try/catch, and a corrupt stored value was shown to
  fall back to the defaults.

## Files / areas

- New: `app/utils/partyHostPins.ts` (+ test), `app/composables/usePartyHostPins.ts`,
  `app/components/party/PartyHostSettings.vue`, `PartyMoreOptions.vue`,
  `PartyPinnedControls.vue`.
- Changed: `PartyHostDashboard.vue`, `usePartyHotkeys.ts` (shortcut text),
  `PartyHotkeyHelp.vue` if it hard-codes the tab line.

## Data / contracts

- No server change. `localStorage` key `gaqSrs:partyHostPins`: JSON array of
  palette command ids.
- `PartyPaletteCommand.tab` keeps its meaning (which Settings tab holds the
  target); `jumpTo` now opens the dialog on it.

## Testing

- Vitest: `partyHostPins.test.ts` (step 1).
- Browser (scratch party server on 4100-4103 against a copy of the database,
  stopped by its own PID only): screenshots of the pop-up, the grid, and the
  dialog; the done-whens above; no page scroll at 1920x1080.
- `bun run test` and `bun run build` green before each checkpoint.

## Notes for the AI

- Client only; components emit commands, the dashboard sends.
- Keep `data-palette-target` attributes on the elements they target.
- Esc closes the topmost dialog only.
- No em dashes.
