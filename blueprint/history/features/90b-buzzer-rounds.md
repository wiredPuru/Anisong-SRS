# Feature: Buzzer rounds

**From build-plan:** feature 90b (parent: 90, Party players and buzzer)
**Status:** verified

## Goal

Turn joined phones (90a) into buzzers. With buzzer mode on, the first player to
buzz while a song is guessing pauses it and gets to answer out loud. The host
marks the answer Correct (a point, then the reveal) or Wrong (that player is
locked out for the rest of the song, playback resumes, and the others can buzz).

## In scope

- A host toggle for buzzer mode, kept across End game.
- Buzz rules (server-side, ordered by server receipt):
  - A buzz counts only in buzzer mode, while the current song is guessing,
    when nobody is already answering, and from a player who is still on the
    scoreboard and not locked out for this song.
  - An accepted buzz pauses playback and makes that player the one answering.
  - Correct gives them 1 point, records them as this song's winner, reveals,
    and resumes playback.
  - Wrong locks them out for this song and resumes playback. If an
    auto-reveal timer ran out while they were answering, Wrong reveals.
  - Moving to another song, or End game, clears the answering player, the
    lock-outs, and the winner. A reveal ends buzzing for that song.
  - Removing the answering player from the scoreboard clears the buzz and
    leaves playback paused for the host.
- The auto-reveal timer does not fire while someone is answering.
- Views:
  - Display: the answering player's name, big, while they answer. The reveal
    overlay names the song's winner.
  - Phone: a big Buzz button whenever it can buzz. States for buzzer off,
    someone else answering, you answering, locked out, and revealed (with the
    anime title, song, artist, and who got it).
  - Host: buzzer toggle; while someone answers, a card with their name and
    Correct / Wrong in Now playing; the winner and lock-outs for the current
    song.
- `POST /api/party/player/buzz` -> `{ accepted: boolean }`.
- A short buzz tone on the display (Web Audio, no asset file) and a vibration on
  the phone that buzzed, where the browser supports it.

## Out of scope

- Awarding points outside a buzz (90c), queue editing (90c), results screen
  (90d).
- A wrong buzz costing points, or buzz-order queues (decided at intake: lock out
  and resume).
- Host hotkeys for Correct/Wrong.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Buzz rules in the game model** - `PartyGameState` gains
  `buzzerEnabled: boolean` (kept across `clear`) and `buzz: PartyBuzz`
  (`{ playerId: number | null; lockedOut: number[]; winnerId: number | null }`,
  reset by every move and by `clear`). Commands:
  - host `{ type: "buzzer"; enabled }` and `{ type: "buzzJudge"; correct }`
  - internal `{ type: "buzz"; playerId }`, never parsed from the host route

  Remove clears a buzz held by the removed player. `toHostState` carries
  `buzzerEnabled` and `buzz`. `toDisplayState` gains
  `buzz: { answering: string | null; winner: string | null }`.
  `toPlayerState` gains the phone's buzzer view and `answer` (anime title,
  song, artist) only once revealed. `timerMayReveal(state)` is false while
  someone answers. *Done when:* `partyGame.test.ts` covers accept, each
  refusal (off, revealed, already answering, locked out, unknown player),
  Correct (point, winner, reveal, playing), Wrong (lock-out, resume, later buzz
  by another player), Wrong after an expired auto-reveal timer revealing,
  reset on move and clear, removal mid-buzz, the internal command refused by
  `parsePartyCommand`, and the phone view carrying no answer until revealed.
- [x] **Step 2 - Buzz route and timer guard** - `POST /api/party/player/buzz`
  runs the internal command through a store helper and answers whether it was
  accepted. The store's auto-reveal timeout checks `timerMayReveal`. *Done
  when:* a `curl` run against `bun run party` shows the first of two phones
  accepted, the second refused, the host state showing the answering player,
  and a Wrong judge letting the second phone buzz.
- [x] **Step 3 - Phone buzzer** - `usePartyPlayer` exposes `buzz()`, and
  `/party/play` shows the Buzz button and the five states, vibrating on an
  accepted buzz. *Done when:* phone screenshots (390x844) show Buzz ready,
  answering, someone else answering, locked out, and revealed with the answer.
- [x] **Step 4 - Host controls** - a Buzzer mode toggle on the Now playing
  panel, and the answering card with Correct / Wrong, plus the song's winner
  and lock-out names. *Done when:* a host screenshot shows the answering card,
  and clicking Correct reveals and adds the point.
- [x] **Step 5 - Display** - the answering overlay with the player's name, the
  winner line on the reveal overlay, and a short Web Audio tone when a buzz
  lands. *Done when:* display screenshots show the answering overlay and the
  reveal credit.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` (+ test), `nuxt-app/server/utils/partyStore.ts`
- `nuxt-app/server/api/party/player/buzz.post.ts` (new)
- `nuxt-app/app/composables/usePartyPlayer.ts`, `nuxt-app/app/pages/party/play.vue`
- `nuxt-app/app/composables/usePartyHost.ts`, `usePartyDisplay.ts`, `nuxt-app/app/components/party/PartyNowPlaying.vue`, `PartyRevealOverlay.vue`, `PartyDisplayOverlays.vue`, `nuxt-app/app/pages/party/display.vue`

## Data / contracts

All in memory; no schema change.

- `PartyBuzz { playerId: number | null; lockedOut: number[]; winnerId: number | null }`
  on `PartyGameState` and `PartyHostState`, plus `buzzerEnabled: boolean`.
  **Load-bearing for 90c** (highlights the buzzer when awarding) and **90d**
  (records each song's winner).
- `PartyDisplayState.buzz: { answering: string | null; winner: string | null }`.
- `PartyPlayerState` gains:
  ```ts
  buzzer: { enabled: boolean; canBuzz: boolean; answering: string | null;
            answeringIsMe: boolean; lockedOut: boolean; winner: string | null };
  answer: { anime: string; song: string; artist: string } | null; // only when revealed
  ```

## Testing

Vitest is on: step 1 covers the rules in `partyGame.test.ts`. Step 2 carries a
`curl` run against the real doors. Steps 3-5 are UI and ride on
`playwright-cli` screenshots against `bun run party` on the scratch data dir,
plus `bun run build`.

## Notes for the AI

- 90a's test asserted the phone view never carries an answer, even when
  revealed. This feature deliberately changes that. The answer appears only
  after the reveal, when the display is already showing it. Update that test to
  assert "none before reveal" rather than deleting it.
- Buzzes are resolved inside the synchronous reducer, so two buzzes arriving
  together are ordered by which request the server handles first. There is no
  client timestamp to trust.
- Pausing on a buzz is just `playing: false`, the same flag the host's pause
  sets, so the display needs no new playback logic.
- Copy uses plain hyphens and no em dashes.

## As built

- `canBuzz(state, playerId)` and `timerMayReveal(state)` are exported from
  `partyGame.ts`. The store's `buzzParty(playerId)` runs the internal `buzz`
  command and reports whether that player is now answering.
- A host Reveal while someone is answering also ends their buzz, so a reveal
  never leaves a stale "answering" name on screen.
- The phone's revealed card shows the English anime title, song, artist, and
  "You got it!" / "<name> got it!" / "Check the screen!".
- The display chime is two short square-wave notes from Web Audio, played only
  after Start and only when the answering name changes.
- The display's join chip hides while an answer is revealed, because it
  overlapped the reveal panel in the bottom-left corner.
- Evidence came from `bun run party` on a scratch data dir:
  - a curl run: buzzer off refused, first buzz accepted and paused, second
    refused, Wrong locked out and let another phone buzz, Correct scored and
    revealed, and an unjoined buzz was refused (401)
  - phone screenshots of each state
  - a host screenshot of the answering card
  - display screenshots of the "buzzed in!" overlay and the "got it!" credit
