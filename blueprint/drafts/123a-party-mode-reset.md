# Feature: Wipe the old party UI, build the new host panel and display (123a)

**From build-plan:** feature 123, sub-feature 123a
**Status:** not started

## Goal

Delete the old party front end and build minimal replacements from scratch around
one loop: pick songs, play, reveal, next. The backend (launcher and doors, host
password and session, game reducer and store, host command route, display SSE
stream, clip tokens, player-door routes) is untouched and reused; trimming it is
123b. Git keeps the deleted code, so the wipe is reversible.

## Design reference

None exists, and the brief is "far fewer controls". The layouts below are the
target and the thing to review before any code. No `prototypes/` folder.

Host panel (one column, about 560px max, centered, works on a phone):

```text
GAQ Party                         (o) Connected     Log out
---------------------------------------------------------
 Song 3 of 20                                  [Hidden]
 Answer (host only)
   Mushishi Zoku Shou
   OP2  Shiver - Lucy Pearl
 ----o------------------------  1:02 / 1:30
 [ Prev ]  [   Play / Pause   ]  [ Reveal ]  [ Next ]
 [x] Random start                       End game
---------------------------------------------------------
 New game                                   (collapsed once a game runs)
   ( All cards | Manual deck )  [deck picker]
   [ Filters (2) ]   [x] Shuffle         812 songs match
   [ Start game ]
---------------------------------------------------------
 Display: http://127.0.0.1:4000/party/display   Host: http://192.168.1.5:4001/party/host
```

Display (full viewport; one fullscreen button on pointer move):

```text
before Start : Kai waving, "Click to start"
no song yet  : Kai sleepy, "Waiting for the host"
playing      : the clip, filling the screen (audio-only: the cover or Kai veil)
revealed     : PartyRevealOverlay (cover, slot, titles, song, artist)
```

## In scope

- **Wipe** every party page body, component, composable, util and test the new
  screens do not need, including `/party/play`, the 576-line `PartyDisplayPlayer`
  and its effect, censor, lightning, bubble, pixel and music-visual code.
- **Host page** (`/party/host`): the existing login / set-password card stays; the
  logged-in view is the single column above.
  - New-game picker: All cards or Manual deck (deck search and pick), Study-style
    filters through the existing `StudyFiltersModal`, Shuffle, live "N songs
    match", Start game.
  - Now playing: song number of total, Hidden/Revealed chip, the answer (host
    only, from the host state's current queue item), a clickable progress bar with
    time, Previous / Play-Pause / Reveal / Next, Random start, End game behind an
    inline confirm.
  - "Try another source" (existing `changeSource` command), shown only when the
    display reports the clip failed or is stuck loading.
  - Hotkeys: Space, R, N or Right Arrow, P or Left Arrow. Ignored in text fields.
  - A footer with the display and host URLs from `/api/party/status`.
- **Display page** (`/party/display`): click-to-start gate (audio autoplay, full
  screen), a new lean clip player, `PartyRevealOverlay` on reveal, a waiting
  screen, `F` and a button for full screen, position reports to the server.
- Commands the new screens send: `load`, `play`, `pause`, `seek`, `next`,
  `previous`, `reveal`, `clear`, `settings`, `changeSource`. All exist today.

## Out of scope

- Any server, reducer, route, schema or launcher change (123b).
- Queue list or editing, add-songs search, effects, lightning, stakes, censor,
  choices, endless mode, scoring, scoreboard, timer, banner, lobby music, rules,
  round summary, layout editor, command bar, shortcuts help, ambient glow,
  tap-to-pause, Skip to end, "Downloaded only". Nothing of these appears on the
  new screens. The picker sends `downloadedOnly: false`; Offline mode's
  "Playable offline only" setting still filters server-side.
- Players: the player door (port 4003) keeps running but `/party/play` is gone, so
  it serves nothing useful until 123b removes it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Party mode is not playable between Step 2 and Step 6 (the old screens are gone,
the new ones are not built yet). That is deliberate and confined to the feature
branch; the app itself keeps building and every non-party page is unaffected.

- [ ] **Step 1 - Transport helpers + test** - `app/utils/partyTransport.ts`:
  `formatClock(seconds)` (`m:ss`, `--:--` for null or non-finite),
  `progressFraction(position)` (0 to 1, 0 without a duration), and
  `seekSecondsFromClick(offsetX, width, duration)` (clamped to the clip) with
  `partyTransport.test.ts`. *Done when:* `bun run test` is green with cases for
  null, zero, over-duration and clamped inputs.
- [ ] **Step 2 - Wipe the old party UI** - delete everything under
  `app/components/party/` except `PartyRevealOverlay.vue`; delete
  `app/pages/party/play.vue`; delete `usePartyHotkeys`, `usePartyLayout`,
  `usePartyPlayer`, `usePartyCommandBar`, `usePartySettledScores` and every
  `app/utils/party*` file (with its test) except `partyVideoSlots`,
  `partyRevealFacts` and `partyTransport`; reduce `host.vue` and `display.vue` to
  a placeholder under the kept login card. Keep `usePartyHost`, `usePartyDisplay`,
  `usePartyFullscreen`, the `party` layout and `party-display-moe.css` (the reveal
  overlay's styles live there, under `.display.moe-theme`). Prove each deletion
  with `grep` that nothing kept or non-party imports it. *Done when:*
  `bun run build` and `bun run test` are green, no import points at a deleted
  file, `/party/host` still shows setup, login and a logged-in placeholder, and
  no non-party page changed.
- [ ] **Step 3 - Host shell and new-game picker** - `PartyHostPanel.vue` (header
  with connection chip and Log out, connect-URLs footer) and `PartyGamePicker.vue`
  (source toggle, deck search via `/api/party/host/decks`, filters modal, shuffle,
  debounced count via `/api/party/host/queue-preview`, Start game via the `load`
  command). `host.vue` renders the panel. *Done when:* logged in, All cards shows a
  count, Start game loads a queue (host state `queue.length` equals the loaded
  count), and a deck with no playable clip shows the existing "None of these songs
  has a clip..." message instead of failing silently.
- [ ] **Step 4 - Now playing and transport** - `PartyHostTransport.vue`: song
  count, Hidden/Revealed chip, host-only answer, clickable progress bar from the
  display's reported position, Previous / Play-Pause / Reveal / Next with edge
  disabling, Random start (`settings`), End game with inline confirm (`clear`),
  "Try another source" on a failed or stuck clip, inline `commandError`. The picker
  collapses once a game runs and reopens from a "New game" button. *Done when:*
  Next and Previous are disabled, not erroring, at the ends; clicking the bar sends
  a `seek` within the clip; End game returns the panel to its no-game state.
  (Display-side behavior is verified in Step 6.)
- [ ] **Step 5 - Hotkeys** - `usePartyHostKeys` (Space, R, N/Right, P/Left) with
  its own typing guard, mounted by the panel. *Done when:* each key does what its
  button does, and typing in the deck search never fires one.
- [ ] **Step 6 - Lean display** - `PartyClipPlayer.vue`, ported from the old player
  but only keeping: preload slots via `assignPartyVideoSlots`, the Safari unlock
  (`unlock()` called inside the start click), play/pause, `startAt`/`seekTo`/random
  `startFraction`, volume, a cover or Kai veil for audio-only and failed clips, and
  position reports. Rewrite `display.vue` around it with the start gate, reveal
  overlay, waiting screen and fullscreen. *Done when:* with host and display in two
  tabs, the display follows start, play, pause, seek, reveal and next with no
  console errors, the host's progress bar moves, and reloading the display returns
  to "Click to start" and then to the current song.
- [ ] **Step 7 - Phone width and end-to-end pass** - the host panel at 390px and at
  desktop width; a full game (load, three songs, reveal each, End game); then
  `bun run build`. *Done when:* no horizontal scroll at 390px, every control
  reachable without a tab or menu, the full game completes, and the build is green.

## Files / areas

- Deleted: `app/components/party/*` except `PartyRevealOverlay.vue`,
  `app/pages/party/play.vue`, the party composables and utils listed in Step 2.
- New: `PartyHostPanel.vue`, `PartyGamePicker.vue`, `PartyHostTransport.vue`,
  `PartyClipPlayer.vue` in `app/components/party/`; `usePartyHostKeys.ts`;
  `app/utils/partyTransport.ts` and its test.
- Rewritten: `app/pages/party/host.vue` (logged-in view), `app/pages/party/display.vue`.
- Kept unchanged: `usePartyHost`, `usePartyDisplay`, `usePartyFullscreen`,
  `PartyRevealOverlay`, `partyVideoSlots`, `partyRevealFacts`, the party layout,
  `party-display-moe.css`, `StudyFiltersModal`, and everything under
  `server/api/party/`, `server/utils/party*` and `launcher/`.

## Data / contracts

- No schema, route or reducer change. Load-bearing for 123b: the new screens depend
  only on these existing shapes.
  - `PartyHostState`: `index`, `queue[index].answer`, `phase`, `playing`, `position`,
    `randomStart`.
  - `PartyDisplayState`: `item`, `upcoming`, `playing`, `startAt`, `seekTo`,
    `seekSeq`, `startFraction`, `songVolume`, `answer`, `phase`.
  - `POST /api/party/host/command` with the ten commands above;
    `POST /api/party/host/queue-preview`; `GET /api/party/host/decks`;
    `GET /api/party/status`; `/api/party/display/{stream,clip,cover,position}`.
- The client-side type copies in `usePartyHost.ts` and `usePartyDisplay.ts` keep
  their full shapes here; 123b narrows them with the server.

## Testing

- `bun run test` is on: Step 1's helpers ship their test in the same diff. UI and
  integration steps ride on browser evidence (the `playwright-cli` skill, or two
  browser tabs) plus `bun run build`.
- Real environment: `bun run build` then `bun run party`, host panel on
  `127.0.0.1:4001`, display on `127.0.0.1:4000`. Re-check password setup, login and a
  wrong password.
- Unhappy paths: empty library (Start disabled, clear message), a deck with no
  matching songs, a clip that fails to load (Try another source appears), the server
  restarting mid-game, the display opened before any game (waiting screen).

## Notes for the AI

- Follow `coding-standards.md`: `<script setup lang="ts">`, scoped styles with
  `var(--token)` only, no inline styles, no commented-out code, no em dashes.
- The Safari audio unlock and slot preloading are the fragile part of the old player.
  Port them faithfully (read the old file from git before deleting it in Step 2, or
  write `PartyClipPlayer` first on the branch); do not reinvent them.
- The display must never receive an answer before reveal; the host panel reads the
  answer from the authenticated host state only.
- Party play never writes `ReviewLog`, `Card` or `CardTrack`; add no such write.
- Mobile first for the host panel: single column, targets at least 44px, no hover
  dependence, Kai light/dark theme tokens from `main.css`.
- Deletions are by explicit list with `grep` proof per file; do not delete anything
  outside `party` names, and leave `server/` and `launcher/` alone.
