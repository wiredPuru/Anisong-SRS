# Feature: Game state and display sync

**From build-plan:** feature 86b (parent: 86, Guess the Anime party mode)
**Status:** verified
**Branch:** `feature/86b-party-game-sync`

## Goal

Give the party server a real game. It keeps one server-held game (a queue of
cards, the current item, and its phase), accepts host commands, and streams a
display-safe view of that game to the display page. The display plays the clip
through an opaque token, reports its playback position back, and shows the
answer only when the host reveals it. 86c builds the host panel on top of the
command API defined here. Until then, `curl` drives it.

## In scope

- A pure game model: queue items, clip choice, a command reducer, and the
  derived display and host views.
- One in-memory game per party process, with change listeners.
- Host API (session, control door):
  - `POST /api/party/host/command`
  - `GET /api/party/host/state`
  - `GET /api/party/host/stream` (SSE)
- Display API (display door):
  - `GET /api/party/display/stream` (SSE)
  - `GET /api/party/display/clip?t=<token>`
  - `POST /api/party/display/position`
- The display page:
  - a click-to-start screen, which unlocks audio autoplay
  - the SSE client
  - a plain video/audio player that follows the server's play, pause, and seek
  - a veil while an audio-only clip plays
  - position reports once a second
  - the reveal overlay (cover, anime title, song, artist, slot)
  - the existing waiting screen when no game is loaded

## Out of scope

- Any host panel UI: queue building from decks or filters, buttons, the
  position mirror (86c). The commands exist here, and `curl` proves them.
- Random start (86c sets `startAt`; 86b always starts at 0).
- Screen effects, lightning rounds, timers, scoreboard (86d-86f).
- Persisting the game across restarts. A restart ends the game.
- Writing reviews. Nothing here touches `ReviewLog`, `Card`, or `CardTrack`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Pure game model** - `server/utils/partyGame.ts`:
  - types (below)
  - `pickPartyClip(card, { clipSource, playbackMode })`
  - `toQueueItem(card, clip, token)`
  - `parsePartyCommand(body)`
  - `applyPartyCommand(state, command, loaded)`, which never mutates its input
  - `toDisplayState(state)` and `toHostState(state)`

  Tests beside it. *Done when:* the tests cover:
  - clip preference: local video over remote video over local audio over
    remote audio
  - `audioOnly` never picks video
  - a remote URL the clip source excludes is skipped
  - no clip at all gives `null`
  - every command's transition
  - no-ops at the queue's ends and with no game
  - command parse errors
  - the display state carrying no answer, path, or URL before reveal
- [x] **Step 2 - Game store and host routes** - `server/utils/partyStore.ts`
  holds the singleton state and change listeners.
  `POST /api/party/host/command` handles `load` by loading the cards
  (`getCardsByIds`), picking clips with the current settings, and dropping
  unplayable cards, reported back as `skipped`. Other commands go straight
  through the reducer. `GET /api/party/host/state` returns the host view.
  *Done when* `curl` through the control door with a session shows:
  - `load` reports loaded and skipped counts
  - `play`, `pause`, `seek`, `next`, `previous`, `reveal`, and `clear` change
    the host state as specified
  - a bad command returns 400
  - without a session, both routes return 401
- [x] **Step 3 - Streams, clip, and position** - three display routes plus a
  host stream:
  - `GET /api/party/display/stream` and `GET /api/party/host/stream` send the
    current view on connect, then again on every change, with a heartbeat
    comment every 5s.
  - `GET /api/party/display/clip?t=` serves the current queue's clip by token
    (local through `serveRangedFile` after `isPathWithinLibrary`, remote
    through the stream cache after `assertClipUrlAllowed`). An unknown token
    returns 404.
  - `POST /api/party/display/position` stores `{ token, currentTime,
    duration, playing }` for the host view, and ignores a stale token.

  The front doors get an `idleTimeout` long enough for the heartbeat. *Done
  when:*
  - `curl -N` on the display stream shows a new event after a host command,
    and its payload has no answer, path, or URL until `reveal`.
  - A clip request with a live token returns 206 for a range request, and
    with a stale token returns 404.
  - A position post shows up in the host state.
- [x] **Step 4 - Display page** - the display page becomes:
  - **Before the click:** a "Click to start" screen.
  - **After the click:** it connects to the stream through a
    `usePartyDisplay` composable, reconnecting on drop with backoff.
  - **Rendering:**
    - the waiting screen (from 86a) with no game
    - a full-window video, or Kai's listening veil for audio
    - the reveal overlay when revealed
  - **Following the server:** it plays, pauses, and seeks when the server
    says so, loads the next clip on a new token, and reports position every
    second and on play/pause.

  *Done when* a `curl`-driven session (load, play, pause, seek, next, reveal)
  is shown in screenshots of the display, and the host state shows the
  reported position advancing.

  Found and fixed while proving this step:
  - A stopped party process kept its two doors listening. Nitro closes only
    its own server on SIGINT/SIGTERM, so the launcher now exits the process
    itself.
  - A door that cannot reach the app now answers a plain 502, never Bun's
    development error page.
  - Study's listening Kai sits off to the side to keep a video clear. On the
    party's audio veil she is centred above the reveal card instead.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `server/utils/partyStore.ts`
- `nuxt-app/server/api/party/host/command.post.ts`, `state.get.ts`,
  `stream.get.ts`
- `nuxt-app/server/api/party/display/stream.get.ts`, `clip.get.ts`,
  `position.post.ts`
- `nuxt-app/launcher/party.ts` (door idle timeout)
- `nuxt-app/app/composables/usePartyDisplay.ts`,
  `app/components/party/PartyDisplayPlayer.vue`,
  `app/components/party/PartyRevealOverlay.vue`, `app/pages/party/display.vue`

## Data / contracts

Load-bearing for 86c-86f (server source in `partyGame.ts`; the client copy in
`usePartyDisplay.ts` keeps the same field order, per F-09):

```ts
type PartyPhase = "idle" | "guessing" | "revealed";
type PartyClipSource = { type: "local"; path: string } | { type: "remote"; url: string };
interface PartyClip { kind: "video" | "audio"; source: PartyClipSource }
interface PartyAnswer {
  animeTitleEnglish: string; animeTitleRomaji: string; animeTitleNative: string;
  songTitle: string; artistName: string; themeSlot: string; coverImageUrl: string | null;
}
interface PartyQueueItem { token: string; cardId: number; clip: PartyClip; answer: PartyAnswer }
interface PartyPosition { token: string; currentTime: number; duration: number | null; playing: boolean }
interface PartyGameState {
  version: number;          // bumps on every command change; a position report does not
  queue: PartyQueueItem[];
  index: number;            // -1 with no game
  phase: PartyPhase;
  playing: boolean;
  startAt: number;          // seconds; 86c's random start sets it
  seekTo: number | null;
  seekSeq: number;          // bumps on every seek so a repeat seek still fires
  position: PartyPosition | null;
}
type PartyCommand =
  | { type: "load"; cardIds: number[]; shuffle?: boolean }
  | { type: "play" } | { type: "pause" } | { type: "seek"; seconds: number }
  | { type: "next" } | { type: "previous" } | { type: "reveal" } | { type: "clear" };

// Sent to the display. Never carries a path, URL, cardId, or answer before reveal.
interface PartyDisplayState {
  version: number; phase: PartyPhase;
  item: { token: string; kind: "video" | "audio"; number: number; total: number } | null;
  playing: boolean; startAt: number; seekTo: number | null; seekSeq: number;
  answer: PartyAnswer | null;
}
// Sent to the host, who may see everything.
interface PartyHostState {
  version: number; phase: PartyPhase; index: number; playing: boolean;
  queue: { cardId: number; kind: "video" | "audio"; answer: PartyAnswer }[];
  position: PartyPosition | null;
}
```

- **`load`:**
  - takes 1-2000 card ids
  - drops unknown ids and cards with no allowed clip, returning
    `{ loaded, skipped }`
  - sets `index` 0, phase `guessing`, paused
  - `shuffle` uses `Math.random` through an injectable function
- **`next`/`previous`** move within the queue. Each resets to `guessing`,
  paused, `startAt` 0, and `position` null. They are no-ops at the ends.
- **`reveal`** only works with a current item.
- **`clear`** returns to the initial state.
- **Tokens** are fresh random hex for every `load`. The previous queue's
  tokens stop resolving.

## Testing

Vitest is on:

- `partyGame.test.ts` covers the clip choice, the command parser, the
  reducer, and both views.
- Routes and SSE ride on `curl` evidence (Steps 2-3).
- The display page rides on screenshots of a `curl`-driven session (Step 4).

Run `bun run test` and `bun run build` before each step closes.

## Notes for the AI

- Party play never writes study state. Only `getCardsByIds` and the settings
  getters are read.
- Reuse `serveRangedFile`, `isPathWithinLibrary`, `resolveCachedPath`,
  `parseAllowedStreamUrl`, and `assertClipUrlAllowed`. Don't reimplement
  range serving or the cache.
- h3 is 1.15, so use `createEventStream`. Route params stay query-based
  (`?t=`), per the no-dynamic-segments convention.
- The display is a dumb renderer. It never decides what plays next, only
  follows `version`-stamped state and ignores an older version.
- Keep the display player simple (a plain `<video>`/`<audio>`), not
  `StudyMediaPlayer`. 86d layers effects on this player.
