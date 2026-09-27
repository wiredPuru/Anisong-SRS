# Feature: Lightning rounds

**From build-plan:** feature 86e (parent: 86, Guess the Anime party mode)
**Status:** verified
**Branch:** `feature/86e-party-lightning-rounds`

## Goal

Let the host run a hands-off timed round. Each song plays from a random
point, the room has a set number of seconds to guess, and the answer reveals
itself, holds briefly, and moves to the next song. That repeats until the
queue ends or the host stops. Seven modes change what the screen shows while
guessing, from the plain clip to progressive hints built from data already
stored.

## In scope

- A `lightning` config in the game:
  `{ mode, guessSeconds (5-60, default 12), revealSeconds (3-30, default 5) }`,
  started or stopped with a `lightning` command.
- **Timing from play time:** the server drives reveal and advance from the
  display's reported `elapsed` play time, so buffering never eats guessing
  time and pausing freezes the round. A manual reveal or move still works
  and resets the clock.
- **Random start:** every lightning song starts at a random point (the
  "random 12-second clip").
- **Modes:**

  | Mode | What the screen shows while guessing |
  |---|---|
  | `regular` | the clip as is |
  | `blind` | Kai's veil (audio only) |
  | `peek` | a small window onto the video that grows and drifts |
  | `cover` | the cover, pixelated, sharpening to clear by the deadline |
  | `clues` | year and season, format, AniList score, then genres, one at a time |
  | `tags` | AniList tags, highest-ranked first, one at a time |
  | `title` | the English title's letters filling in randomly |

- **Hints are server-computed** from elapsed time, so the display only ever
  receives hints already revealed.
- **A countdown bar** on the display.
- **A host Lightning panel:** mode, seconds, Start and Stop. While a round
  runs, the Effects panel shows that the mode owns the screen.

## Out of scope

- The reference tool's OpenAI, YouTube, Google Images, and character modes
  (per the plan).
- Variety mode, background music, banners, timers beyond the countdown,
  scoreboard, hotkeys (86f or later).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lightning in the game model** - the following, with tests:
  - `PartyLightning`, `parsePartyLightning`, and a `lightning` command
    (`null` stops it)
  - `PartyPosition` gains `elapsed`
  - the state gains `revealedAtElapsed`, set from the latest elapsed on
    reveal
  - while lightning is on, every move rolls a `startFraction`
  - a pure `lightningStep(state)` that returns `"reveal"` once elapsed
    reaches `guessSeconds` while guessing, `"next"` once it reaches
    `revealedAtElapsed + revealSeconds` while revealed, `"stop"` at the
    queue's end, and otherwise `null`

  *Done when:* the tests cover the parser, the command, the forced random
  start, every `lightningStep` branch, and a paused or stale position doing
  nothing.
- [x] **Step 2 - Hints** - `PartyQueueItem` gains `details` (year, season,
  format, averageScore, genres, tags), loaded by the store in one query per
  load. `lightningHints(item, mode, elapsed, guessSeconds)` is pure:
  - `clues` and `tags` reveal items evenly across the guess time
  - `title` masks letters of `animeTitleEnglish` and reveals them in a
    token-seeded random order, reaching the whole title at the deadline
    (spaces and punctuation always shown)

  `toDisplayState` carries `lightning: { mode, guessSeconds, hints }` with
  only the hints revealed so far. *Done when:* the tests cover each hint
  type at 0, halfway, and the deadline; the seeded order is stable; and no
  hint appears in the display state before its time.
- [x] **Step 3 - Auto-drive and display modes** - the store runs
  `lightningStep` on every accepted position report and commits the result.
  The display:
  - reports `elapsed`
  - shows the countdown bar while guessing
  - renders each mode: regular video, the blind veil, the peek window
    (`clip-path` circle growing from 12% to 45% and drifting), the cover
    sharpening from 64px blocks, and clue, tag, and title cards over the
    veil

  The effects panel's settings are set aside while a round runs, apart from
  mute. *Done when:* screenshots show every mode mid-guess, and a `curl`
  session shows reveal and next happening on their own at the right times.
- [x] **Step 4 - Host Lightning panel** - `PartyLightningPanel`:
  - a mode picker with a one-line description of each mode
  - guess and answer seconds
  - Start (sends `lightning` and `play`) and Stop
  - a "Lightning: <mode>" chip in Now playing while a round runs

  The Effects panel shows a note that effects are paused. *Done when:*
  paired screenshots show a round started from the panel advancing by
  itself.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `server/utils/partyLightning.ts`
  (+ test), `server/utils/partyStore.ts`
- `nuxt-app/app/composables/usePartyDisplay.ts`, `usePartyHost.ts`
- `nuxt-app/app/components/party/PartyDisplayPlayer.vue`,
  `PartyLightningHints.vue`, `PartyLightningPanel.vue`, `PartyNowPlaying.vue`,
  `PartyEffectsPanel.vue`, `PartyHostDashboard.vue`, `app/pages/party/display.vue`

## Data / contracts

```ts
type PartyLightningMode = "regular" | "blind" | "peek" | "cover" | "clues" | "tags" | "title";
interface PartyLightning { mode: PartyLightningMode; guessSeconds: number; revealSeconds: number }
interface PartyAnimeDetails {
  year: number | null; season: string | null; format: string | null;
  averageScore: number | null; genres: string[]; tags: { name: string; rank: number }[];
}
type PartyHints =
  | { kind: "clues"; items: { label: string; value: string }[] }
  | { kind: "tags"; items: string[] }
  | { kind: "title"; masked: string }
  | null;
// PartyGameState gains: lightning: PartyLightning | null; revealedAtElapsed: number | null
// PartyQueueItem gains: details: PartyAnimeDetails
// PartyPosition gains: elapsed: number
// PartyCommand gains: { type: "lightning"; config: PartyLightning | null }
// PartyDisplayState gains: lightning: { mode; guessSeconds; hints: PartyHints } | null
// PartyHostState gains: lightning: PartyLightning | null
```

- **Stored settings:** `lightning` survives `clear` and `load`, like
  `effects`: it is how the host wants to play.
- **Masking:** a `title` mask replaces each hidden letter or digit with `_`
  and keeps its position, so word lengths show.

## Testing

Vitest is on:

- The model's lightning rules, `lightningStep`, and every hint builder get
  unit tests.
- Display modes and the host panel ride on screenshots.
- Auto-advance rides on a `curl`-driven session with timestamps.

Run `bun run test` and `bun run build` before each step closes.

## Notes for the AI

- Hints are answer-derived. Compute them server-side from elapsed time and
  send only what is showing, the same way the answer itself only arrives on
  reveal.
- Auto-reveal and advance use the display's play time, reported about once a
  second, so they can land up to a second late. That is fine for a party
  game.
- Party play still writes nothing to study state.
