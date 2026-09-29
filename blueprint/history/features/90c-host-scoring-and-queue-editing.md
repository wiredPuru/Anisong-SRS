# Feature: Host scoring and queue editing

**From build-plan:** feature 90c (parent: 90, Party players and buzzer)
**Status:** verified

## Goal

Make running a live game less fiddly. After a reveal, the host awards the point
with one tap per player instead of hunting for the scoreboard's small +/-
buttons. The running queue can have upcoming songs removed, reordered, or
appended, instead of every change meaning a new load that replaces it.

## In scope

- Per-song awards:
  - `awards: Record<token, playerId[]>` in the game state, recording who
    scored each song.
  - A host `award` command toggles a player's point for the current song:
    awarding adds 1 to their score and records them; toggling off takes the
    point back and drops the record.
  - 90b's buzz Correct records its winner here too, and toggling that winner
    off also clears `buzz.winnerId`.
  - Awards are kept when moving between songs, so going back to a song still
    shows who scored it. A new load or End game resets them.
- Host "Who got it?" row in Now playing once the song is revealed:
  - one button per player, pressed for players already awarded this song
  - the 90b buzz winner is the pressed one after a Correct
- Queue editing, for upcoming songs only (after the current one):
  - `queueRemove { index }` and `queueMove { from, to }`
  - `load` gains `append: true`, which adds the resolved songs to the end of
    the running queue, skipping cards already in it, up to the existing
    2000-song cap
- Host UI:
  - move up, move down, and remove buttons on each upcoming queue row
  - the queue builder offers "Add N songs to queue" next to "Start new game"
    once a game is running

## Out of scope

- Editing songs already played or the current song (use Next or Jump).
- Drag-and-drop reordering.
- Point values other than 1 per award.
- The results screen (90d), which will read `awards`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Awards in the model** - `PartyGameState.awards`, the host
  command `{ type: "award"; playerId; awarded: boolean }` (current song only,
  known players only, idempotent), buzz Correct recording its winner, reset on
  a non-append load and on clear, kept across moves. `toHostState` carries
  `currentAwards: number[]` (the current song's), not the token-keyed map.
  *Done when:* tests cover award and un-award (score and record), repeat
  awards being no-ops, unknown player refused, Correct recorded, un-awarding
  the buzz winner clearing `winnerId`, awards surviving next/previous, and
  reset on load and clear.
- [x] **Step 2 - Queue edits in the model and store** - host commands
  `queueRemove { index }` and `queueMove { from, to }`, which accept only
  indexes after the current song and within the queue. `load` accepts
  `append: boolean`: the store resolves the new cards (skipping ones already
  queued), and the reducer appends them without moving the current song,
  respecting `PARTY_LOAD_MAX`. Removing a song drops its `awards` entry.
  *Done when:* tests cover remove and move (including refusing the current and
  played songs and out-of-range indexes), append keeping the current song,
  playing state, and phase, and the parser's rejects; and a `curl` append
  against `bun run party` grows the queue.
- [x] **Step 3 - "Who got it?" on the host** - once revealed, Now playing
  shows a button per player, pressed for this song's awards, toggling
  `award`. *Done when:* a host screenshot after a reveal shows the row with
  the buzz winner pressed, and tapping another player adds their point.
- [x] **Step 4 - Queue editing on the host** - up, down, and remove on
  upcoming rows in `PartyQueueList`, and the builder's add-to-queue button.
  *Done when:* a host screenshot shows the controls, and a browser run moves,
  removes, and appends songs with the display still on the current song.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `nuxt-app/server/utils/partyStore.ts`
- `nuxt-app/app/composables/usePartyHost.ts`, `nuxt-app/app/components/party/PartyNowPlaying.vue`, `PartyQueueList.vue`, `PartyQueueBuilder.vue`, `PartyHostDashboard.vue`

## Data / contracts

All in memory; no schema change.

- `PartyGameState.awards: Record<string, number[]>`, keyed by queue item
  token. **Load-bearing for 90d**, which lists each played song's scorers from
  it. It stays server-side: the host view gets `currentAwards: number[]`, and
  the display and phone views get none of it.
- Commands: `award { playerId, awarded }`, `queueRemove { index }`,
  `queueMove { from, to }`, `load { ..., append?: boolean }`.

## Testing

Vitest is on: steps 1 and 2 cover the model in `partyGame.test.ts`. Step 2
also carries a `curl` append against `bun run party`. Steps 3 and 4 are UI,
covered by `playwright-cli` screenshots against the scratch data dir plus
`bun run build`. The next browser run also confirms 90b's fix that hides the
display's join chip during a reveal.

## Notes for the AI

- `toHostState` maps queue items without tokens, so the host never needs one:
  awards reach it as the current song's list.
- `commit` already prefetches whenever the queue array changes, so edits keep
  the lookahead correct.
- Copy uses plain hyphens and no em dashes.

## As built

- `applyAward` in `partyGame.ts` toggles one point per player per song and
  keeps `awards[token]` in step. Un-awarding the buzz winner also clears
  `buzz.winnerId`, so the display's "got it" credit follows the host's
  correction. `toHostState` exposes only `currentAwards`, so queue tokens never
  reach the host.
- `queueRemove` and `queueMove` act only on songs after the current one. A
  removed song's `awards` entry goes with it.
- `load` with `append: true`: the store drops card ids already queued and caps
  the rest at the room left under 2000 before resolving, so the reported count
  is what was added. With nothing loaded it starts a fresh game.
- The queue builder shows "Add N songs to queue" and "Start new game" while a
  game runs. "Every matching song is already in the queue." covers an append
  that adds nothing.
- Evidence came from `bun run party` on a scratch data dir:
  - a curl run: append skipping duplicates, a move, a remove, and refusal to
    remove the current song
  - a host UI run: buzz Correct pre-pressing the winner in "Who got it?",
    tapping a second player to award them, and moving, removing, and
    appending queue songs with the display staying on song 1
  - a display check that the join chip is hidden during a reveal (90b's fix)
