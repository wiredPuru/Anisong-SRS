# Feature: Host polish

**From build-plan:** feature 86f (parent: 86, Guess the Anime party mode)
**Status:** verified
**Branch:** `feature/86f-party-host-polish`

## Goal

Round out the host's toolkit for running a real event:
- a countdown timer the room can see, which can auto-reveal
- a manual scoreboard, shown on the display when the host wants
- big round banners
- lobby music that fills silence between songs
- keyboard shortcuts on the host panel

## In scope

- **Timer:**
  - `timer: { seconds; endsAt; autoReveal } | null`
  - on the display, a large countdown in the corner, then "Time's up!"
  - a server timeout reveals at `endsAt` when `autoReveal` is on
  - moving to another song cancels it
- **Scoreboard:**
  - `scoreboard: { players: { id; name; score }[]; visible }`
  - commands to add, rename, remove, and adjust a player; reset scores;
    show or hide
  - the display shows a ranked overlay while it is visible
- **Banner:** `banner: { text; shownAt } | null`. The display shows it big
  for 4 seconds, and the host can clear it early.
- **Lobby music:**
  - `music: { enabled; volume }`, playing tracks from a `party-music` folder
    beside the database (created on first use)
  - the display plays them shuffled, only while no song is playing (no game,
    paused, or ended), fading in and out
  - `GET /api/party/display/music?i=` serves a track by index
  - `GET /api/party/host/music` lists the tracks and the folder path
- **Hotkeys** on the host panel, ignored while typing:

  | Key | Action |
  |---|---|
  | Space | play/pause |
  | R | reveal |
  | N or Right | next |
  | P or Left | previous |
  | M | mute |
  | T | start the timer |
  | S | show or hide the scoreboard |
  | ? | help |

## Out of scope

- Per-player buzzers or answers from audience devices. The plan's non-goals
  rule out a player-device quiz.
- Persisting the scoreboard or music settings across restarts.
- Image banners. Banners are text, in the app's own banner style.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Timer, scoreboard, banner, and music in the model** - with
  tests:
  - state fields and commands: `timer` (start with seconds 3-120 and
    autoReveal; stop), `score` (op `add`/`rename`/`remove`/`adjust`/`reset`/
    `show`), `banner` (text 1-60 chars or null), and `music`
  - a move clears the timer
  - `clear` keeps the scoreboard, banner off, and music
  - the display view gets `timer`, `scoreboard` (only while visible),
    `banner`, and `music`
  - `now` is injected so `endsAt` is testable

  *Done when:* the tests cover every command's transition and validation,
  name trimming, and score changes by 1 or any whole number.
- [x] **Step 2 - Server timer and music routes** - the store schedules the
  auto-reveal at `endsAt` and cancels it on any timer change or move.
  `partyMusic.ts` lists audio files (`.mp3 .m4a .ogg .opus .wav .webm
  .flac`) in the folder, and the two music routes use it (tracks served
  through `serveRangedFile`). *Done when:*
  - a `curl` session shows a 3-second auto-reveal timer revealing on its
    own, and a moved song cancelling one
  - the host music route lists a file dropped into the folder
  - the display route serves it by index, with a range request returning 206
- [x] **Step 3 - Display overlays and lobby music** - the display shows:
  - the timer (a corner countdown, then "Time's up!")
  - the scoreboard overlay
  - the banner overlay
  - lobby music: a hidden `<audio>` that plays shuffled tracks at the set
    volume, only while no song is playing, fading over about a second

  *Done when:* screenshots show the timer, "Time's up", the scoreboard, and a
  banner, and an `eval` shows the music element playing while paused and
  stopped while a song plays.
- [x] **Step 4 - Host controls and hotkeys** - the dashboard gains:
  - a "Show" panel: timer presets 10, 15, 20, 30 plus custom, an
    auto-reveal toggle, Stop, banner text with Show and Clear, and music
    on/off, volume, and the track count and folder
  - a Scoreboard panel: add a player, plus and minus, rename in place,
    remove, reset, and Show on screen
  - the hotkeys above, with a "?" help sheet

  *Done when:* paired screenshots show the timer, a scoreboard, and a banner
  driven from the panel, and a keypress test shows Space, R, and N working
  (and not while typing in a field).

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `server/utils/partyStore.ts`,
  `server/utils/partyMusic.ts` (+ test)
- `nuxt-app/server/api/party/display/music.get.ts`, `server/api/party/host/music.get.ts`
- `nuxt-app/app/composables/usePartyDisplay.ts`, `usePartyHost.ts`,
  `usePartyHotkeys.ts`
- `nuxt-app/app/components/party/PartyDisplayOverlays.vue`, `PartyLobbyMusic.vue`,
  `PartyShowPanel.vue`, `PartyScoreboardPanel.vue`, `PartyHotkeyHelp.vue`,
  `PartyHostDashboard.vue`, `app/pages/party/display.vue`

## Data / contracts

```ts
interface PartyTimer { seconds: number; endsAt: number; autoReveal: boolean }   // endsAt: epoch ms
interface PartyPlayer { id: number; name: string; score: number }
interface PartyScoreboard { players: PartyPlayer[]; visible: boolean }
interface PartyBanner { text: string; shownAt: number }
interface PartyMusic { enabled: boolean; volume: number }  // volume 0-1
type PartyCommand = /* earlier */
  | { type: "timer"; seconds: number; autoReveal: boolean } | { type: "timerStop" }
  | { type: "score"; op: "add"; name: string }
  | { type: "score"; op: "rename"; id: number; name: string }
  | { type: "score"; op: "remove"; id: number }
  | { type: "score"; op: "adjust"; id: number; delta: number }
  | { type: "score"; op: "reset" }
  | { type: "score"; op: "show"; visible: boolean }
  | { type: "banner"; text: string | null }
  | { type: "music"; enabled: boolean; volume: number };
// GET /api/party/host/music -> { folder: string; tracks: string[] }  (file names)
// GET /api/party/display/music?i=<index> -> the audio file
```

- **Players:** names are trimmed, 1-24 characters, with at most 20 players.
  Ids count up from 1 per process.
- **Music tracks** are listed fresh on each request, so files added mid-event
  show up on the next track.

## Testing

Vitest is on:

- The model's commands and `partyMusic`'s file filter get unit tests.
- The timer and music routes ride on `curl`.
- Overlays, music playback, the panels, and hotkeys ride on screenshots and
  `eval` evidence.

Run `bun run test` and `bun run build` before each step closes.

## Notes for the AI

- Lobby music must never overlap a song: it plays only while
  `!state.item || !state.playing`, and pauses before a song starts. Features
  18 and 32 died of overlapping audio.
- The display and server share a machine, so `endsAt` needs no clock-skew
  handling there. A phone's host view may drift slightly, which is fine.
- Party play still writes nothing to study state.
