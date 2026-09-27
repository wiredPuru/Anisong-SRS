# Feature: Host panel - queue and transport

**From build-plan:** feature 86c (parent: 86, Guess the Anime party mode)
**Status:** verified
**Branch:** `feature/86c-party-host-panel`

## Goal

Turn the host panel's placeholder into the game's remote control. The host
builds a queue from all cards, an artist, anime, or manual deck, optionally
narrowed by Study's filters and shuffled. They then run the game with play,
pause, previous, next, seek, random start, and reveal. A live mirror shows
what the display is playing, where it is in the clip, and the answer the room
is guessing. It works from a phone.

## In scope

- Game model additions:
  - a `randomStart` setting, and a per-item `startFraction` the display
    turns into seconds
  - a `jump` command to any queue item
  - a `settings` command
- Queue sources:
  - `POST /api/party/host/queue-preview` resolves a scope plus optional
    filters to card ids (shuffled and capped at 2000 on request).
  - Host-door copies of the deck list, filter options, and list lookup that
    the builder needs, since the control door never reaches SRS routes.
- `StudyFilterForm` gains an `apiBase` prop (default `/api/study`), so the
  host panel reuses it unchanged otherwise.
- The host page, logged-in view:
  - a queue builder (source, deck search, filters, shuffle, Load)
  - a now-playing mirror (number and total, answer, reveal state, progress)
  - transport buttons and a seekable progress bar
  - the queue list, where tapping an item jumps to it
  - the random-start toggle
  - Clear game

## Out of scope

- Screen effects (86d), lightning rounds and auto-advance (86e), timers,
  scoreboard, and hotkeys (86f).
- Saving queues or presets. Editing a loaded queue beyond jump and clear.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Random start and jump in the game model** -
  `PartyGameState` gains `randomStart: boolean` and `startFraction: number`.
  Moving to an item (`load`, `next`, `previous`, `jump`) sets
  `startFraction` from the injected random source when `randomStart` is on,
  else 0. New commands:
  - `{ type: "settings"; randomStart: boolean }`, which applies from the
    next song, since the current one has already started
  - `{ type: "jump"; index: number }`

  `PartyDisplayState` gains `startFraction`. The display player starts at
  `startAt || startFraction * max(0, duration - 15)`, matching Study's rule
  of never starting in a clip's last 15 seconds. *Done when:* tests cover
  both commands, the fraction on every move with the setting on and off,
  jump bounds, and parse errors, and the display starts partway through a
  clip with random start on (host-state position after load).
- [x] **Step 2 - Queue sources and host data routes** -
  `server/utils/partySources.ts`:
  - `parsePartySource(body)`, which checks the scope (`all`, `artist`,
    `anime`, `created` + id) and the filters string with `parseStudyFilters`
  - `listPartyCardIds(scope, filters)`, reusing `cards.ts`'s scope condition
    (exported for this) and `studyFilterCondition`
  - `pickPartyQueue(ids, shuffle)`, which shuffles, then caps at 2000

  Routes:
  - `POST /api/party/host/queue-preview` returns `{ cardIds, total }`:
    shuffled when asked, then capped at 2000
  - `GET /api/party/host/decks`, `filter-options`, and `list-anime` reuse the
    SRS routes' handlers
  - `StudyFilterForm` gains `apiBase`

  *Done when:*
  - tests cover the parser
  - `curl` shows preview counts for all, a deck, and a filtered deck, and a
    shuffled preview differing in order
  - the three data routes answer through the control door with a session
    and return 401 without one
- [x] **Step 3 - Queue builder** - the host page's "New game" panel:
  - a source picker (All cards / Artist / Anime / Manual deck)
  - a deck search list for the chosen type
  - a Filters button opening `StudyFilterForm` in a modal, with an
    active-count badge
  - shuffle (on by default)
  - "Load N songs", which previews and then sends `load`

  It shows errors and the "N of M, capped at 2000" note. `StudyFiltersModal`
  gained `apiBase`, `title`, and `hint` props for it. The logged-in view
  moved into `PartyHostDashboard.vue`, and the connection URLs into a
  collapsible "Connect a display or phone" panel. *Done when:*
  screenshots on desktop and phone width show the builder, a filtered deck
  preview count, and a loaded game.
- [x] **Step 4 - Now playing, transport, and queue** - the host page follows
  `/api/party/host/stream` (a `usePartyHost` composable, reconnecting like
  the display), showing:
  - the current song's answer (the host always sees it), with a
    "Revealed" or "Hidden" chip
  - a progress bar from the display's reported position, where a click or
    tap seeks
  - Play/Pause, Previous, Next, and Reveal buttons
  - the random-start toggle
  - the queue list with the current item marked (a tap jumps)
  - Clear game, behind a confirm
  - a notice when the display has not reported yet ("Open the display
    screen and click Start")

  *Done when:* screenshots show the panel mid-game on desktop and phone, and
  each button visibly changes the display in a paired screenshot.

  Found and fixed while proving this step:
  - A card whose local file is missing from disk (a stale path) picked that
    path and 404ed. `pickPartyClip` now takes a `localFileUsable` check (the
    store passes "exists, is a file, inside the library"), so a stale path
    falls back to the stream.
  - A remote clip plays only once fully cached, so the store now prefetches
    the current and next two songs' remote clips whenever the game moves,
    like Study's lookahead.
  - Jumping scrolls only the queue list, never the page.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `app/composables/usePartyDisplay.ts`,
  `app/components/party/PartyDisplayPlayer.vue`
- `nuxt-app/server/utils/partySources.ts` (+ test), `server/utils/cards.ts` (export
  the scope condition)
- `nuxt-app/server/api/party/host/queue-preview.post.ts`, `decks.get.ts`,
  `filter-options.get.ts`, `list-anime.get.ts`
- `nuxt-app/app/components/study/StudyFilterForm.vue` (`apiBase` prop)
- `nuxt-app/app/composables/usePartyHost.ts`, `app/components/party/PartyQueueBuilder.vue`,
  `PartyNowPlaying.vue`, `PartyQueueList.vue`, `app/pages/party/host.vue`

## Data / contracts

Additions to 86b's load-bearing shapes:

```ts
interface PartyGameState { /* 86b fields */ randomStart: boolean; startFraction: number }
type PartyCommand = /* 86b commands */
  | { type: "jump"; index: number }
  | { type: "settings"; randomStart: boolean };
interface PartyDisplayState { /* 86b fields */ startFraction: number }
interface PartyHostState { /* 86b fields */ randomStart: boolean }

type PartyScope = { type: "all" } | { type: "artist" | "anime" | "created"; id: number };
// POST /api/party/host/queue-preview
//   body { scope: PartyScope; filters?: string; shuffle?: boolean }
//   -> { cardIds: number[]; total: number }
```

- **`randomStart`** survives `load` and `clear`. It is a host preference, not
  part of a game.
- **`startFraction`** is in `[0, 1)`. The display converts it to seconds only
  once it knows the duration. A clip under 15 seconds starts at 0.
- **Queue order:** preview ids come from the source query in title order,
  unless shuffled.

## Testing

Vitest is on:

- `partyGame.test.ts` gets the new commands and fraction rules.
- `partySources.test.ts` covers the source parser.
- Routes ride on `curl`. The host panel and the paired display changes ride
  on screenshots.

Run `bun run test` and `bun run build` before each step closes.

## Notes for the AI

- The host panel talks only to `/api/party/**`. Any SRS data it needs goes
  through a host-door route that wraps the existing util or handler, never a
  new copy of the logic.
- Keep the page phone-first. A single column under 820px is the whole host
  experience on a phone. Buttons are big enough to tap.
- Party play still writes nothing to study state.
