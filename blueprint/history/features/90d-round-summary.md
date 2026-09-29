# Feature: Round summary

**From build-plan:** feature 90d (parent: 90, Party players and buzzer)
**Status:** verified

## Goal

Give a game a proper ending. A results screen on the display shows the ranked
standings and each played song with who scored it. The host can put it up
between songs, and it comes up by itself when the queue runs out.

## In scope

- `summaryVisible` in the game state, set by a host `{ type: "summary"; visible }`
  command.
- Automatic at the end of the queue:
  - Next on the last song, which today does nothing, shows the results.
  - A lightning round reaching the end of its queue shows the results as well
    as pausing, where today it only pauses.
- Any move to another song, a new load, and End game hide the results.
- `toDisplayState` gains `summary`, built only while visible:
  - `standings`: every player's name and score, highest first, with shared
    ranks for ties
  - `songs`: the played songs (before the current one, plus the current one
    once revealed), each with its number, anime title, song title, and the
    names of the players who scored it, from 90c's `awards`
  - `total` and `played` counts, so the display can say "12 of 20 songs"
- The display's results screen (`PartyRoundSummary`) covers the player while
  visible, showing the standings and the most recent played songs (at most 12,
  newest first, with "and N earlier" when there are more).
- Host:
  - a Show results / Hide results button in Now playing
  - Next on the last song reads "Show results"

## Out of scope

- Saving results after the party process stops, or exporting them.
- Results on phones beyond the standings they already show.
- Per-player history pages.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Summary in the model** - `summaryVisible`, the `summary`
  command, Next at the end showing it, moves, loads, and clear hiding it, the
  store's lightning "stop" also showing it, and `toDisplayState`'s `summary`
  built by an exported pure `buildSummary(state)`. *Done when:* tests cover
  show and hide, Next at the end, a move hiding it, tie ranks, played songs
  excluding an unrevealed current song and including a revealed one, scorer
  names from awards (a removed player's award dropped), and `summary` being
  `null` while hidden.
- [x] **Step 2 - Results screen on the display** - `PartyRoundSummary.vue`,
  shown by `display.vue` over the game while `summary` is set. *Done when:*
  display screenshots at 1280x720 in both themes show standings and played
  songs with scorers after a short game.
- [x] **Step 3 - Host controls** - Show/Hide results in Now playing, and Next
  relabelled "Show results" on the last song. *Done when:* a host screenshot
  shows the button, and a browser run at the last song shows the results on
  the display via Next, then hides them with Hide results.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `nuxt-app/server/utils/partyStore.ts`
- `nuxt-app/app/components/party/PartyRoundSummary.vue` (new), `nuxt-app/app/pages/party/display.vue`, `nuxt-app/app/composables/usePartyDisplay.ts`
- `nuxt-app/app/components/party/PartyNowPlaying.vue`, `nuxt-app/app/composables/usePartyHost.ts`

## Data / contracts

All in memory; no schema change.

- `PartyGameState.summaryVisible: boolean` (also on the host view).
- `PartyDisplayState.summary`:
  ```ts
  { standings: { rank: number; name: string; score: number }[];
    songs: { number: number; anime: string; song: string; scorers: string[] }[];
    played: number; total: number } | null
  ```

## Testing

Vitest is on: step 1 covers `buildSummary` and the commands in
`partyGame.test.ts`. Steps 2 and 3 are UI, covered by `playwright-cli`
screenshots against `bun run party` on the scratch data dir plus
`bun run build`.

## Notes for the AI

- A song after the current one, and the current one before it is revealed,
  must never appear in `summary`: the display must not show an answer early.
- A skipped song (moved past without a reveal) is "played" and its title may
  appear. That is fine, because it is behind the game.
- Copy uses plain hyphens and no em dashes.

## As built

- `buildSummary(state)` in `partyGame.ts` builds the results from the
  scoreboard and 90c's `awards`. It counts the current song only once
  revealed, ranks ties together (1, 1, 3), and drops scorers no longer on the
  scoreboard. `toDisplayState` sends it only while `summaryVisible` is on.
- Next on the last song now shows the results instead of doing nothing, and a
  lightning round that reaches the end pauses and shows them. The existing
  "stops at both ends" test was updated to expect that.
- The host's Next button reads "Show results" on the last song, and Now
  playing has a Show results / Hide results link beside the round options.
- On the results screen, "Nobody" is muted rather than in the scorer green.
- Evidence came from `bun run party` on a scratch data dir: a four-song game
  scored through the host API, then Show results pressed in the host UI.
  Display screenshots in both themes show tied standings (Bea 3, then Aki and
  Cid tied at 2nd with 1) and each song's scorers, and Hide results cleared the
  screen.
