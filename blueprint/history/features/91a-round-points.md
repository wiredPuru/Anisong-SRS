# Feature: Round points

**From build-plan:** feature 91a
**Status:** verified

## Goal

Make points given during a party song obvious on the display and keep them
visible for that song. Every gain in the current song (a buzz judged Correct,
a one-tap award, or the scoreboard's +/-) adds to a per-song tally the display
shows in a small side panel until the next song starts. The display waits for
score changes to settle (2 seconds with no further change) and then shows one
prominent "+N name" pop per player, so four quick +1 taps read as one +4. The
reveal card stops saying "<name> got it!".

## In scope

- Server-held per-song tally, `roundPoints`, in `PartyGameState`: net points
  per player for the current song, reset on every song move, on `load`, and on
  `clear`. Changed by `score`/`adjust`, `award`, and a Correct `buzzJudge`.
- `toDisplayState` carries the tally as named rows (nonzero only), so a
  display reload mid-song still shows it.
- Display-side settling: the scoreboard and round panel on the display update
  only after 2s (`SCORE_SETTLE_MS`) with no further score change; the pop
  shows the settled gain.
- A "This round" side panel on the display, shown while a song is current and
  the tally is non-empty, in any phase.
- A "+N name" pop per player whose round total went up, shown for about
  2.5s, animated, and still under `prefers-reduced-motion` (no motion, just
  shown and hidden).
- Removing the reveal card's "got it!" line and `buzz.winner` from the display
  view.

## Out of scope

- Moving or resizing any display piece - that is 91b. The round panel gets a
  fixed position here, and 91b makes it movable.
- The host panel and phones: both stay instant. The host's Now playing "Got
  it" log and the phone's "You got it!" are unchanged.
- The round summary's per-song scorers (feature 90d), which still read
  `awards`.
- Sounds for a pop.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Server tally** - add `roundPoints: Record<number, number>`
  to `PartyGameState` (`{}` in `initialPartyState`, reset in `atItem`). Update
  it in `applyScore` `adjust` (only while a song is current), `applyAward`,
  and `judgeBuzz` (Correct). `reset` clears it; `remove` drops that player's
  entry. `toDisplayState` gains `roundPoints: PartyRoundPoint[]` (nonzero
  entries, points descending then name) and loses `buzz.winner`. Mirror the
  shape in `usePartyDisplay.ts`. *Done when:* `bun run test` passes new cases:
  four `adjust +1` read as `+4`; award then take-back nets zero and drops the
  row; a Correct buzz counts; `next`/`jump`/`previous`/`load`/`clear` empty it;
  `adjust` with no song current does not add a row; `reset` empties it; the
  display view has no `winner`.
- [x] **Step 2 - Settle logic** - a pure `app/utils/partyScoreSettle.ts`:
  `needsSettle(shown, next)` (true only when the song token is the same and a
  round total or any player's score changed) and `scorePops(shown, next)`
  (per player, the positive rise in round total within the same token, named
  from `next`). *Done when:* unit tests pass for: +1 x4 -> one +4 pop;
  +1 then -1 -> no pop; a reset -> no pop; a new token -> no pops from
  `scorePops` against the new song; a rename or scoreboard show/hide alone
  -> `needsSettle` false.
- [x] **Step 3 - Settled scores on the display** - a `usePartySettledScores`
  composable holding the shown `{ token, roundPoints, scoreboard }`. The
  first state applies at once; a change where `needsSettle` is true restarts a
  2s timer and applies the latest state when it fires; any other change, and a
  token change, applies at once (flushing a pending change first).
  `display.vue` passes the settled scoreboard to `PartyDisplayOverlays` and
  renders a new `PartyRoundPoints.vue` panel (left side, below the timer, in
  the Kai sticker style). Remove the reveal card's winner line and prop.
  *Done when:* in `bun run party`, four quick `+` taps on one player change
  the display's scoreboard and panel once, about 2s after the last tap, to +4;
  the panel stays through the reveal and empties on Next; the reveal card
  shows no "got it!" line; reloading the display mid-song shows the panel.
- [x] **Step 4 - Pops** - when a settled change applies, the composable
  returns the `scorePops` from Step 2 (including pending gains flushed by a
  token change); the display shows each as a large "+N name" sticker near the
  round panel for about 2.5s, stacking when several players score together.
  *Done when:* the four-tap case shows one "+4 Mika" pop; awarding two players
  at once shows two pops; a take-back or Reset scores shows none; hitting
  Next within 2s of a tap still shows the pop; reduced motion shows it without
  animation.

## Files / areas

- `nuxt-app/server/utils/partyGame.ts` and `partyGame.test.ts` - tally,
  display view.
- `nuxt-app/app/composables/usePartyDisplay.ts` - client copy of the display
  shape.
- `nuxt-app/app/utils/partyScoreSettle.ts` (+ `.test.ts`) - new, pure.
- `nuxt-app/app/composables/usePartySettledScores.ts` - new.
- `nuxt-app/app/components/party/PartyRoundPoints.vue` - new panel and pops.
- `nuxt-app/app/components/party/PartyRevealOverlay.vue` - drop winner line.
- `nuxt-app/app/pages/party/display.vue` - wiring.

## Data / contracts

Load-bearing for 91b, which makes the panel movable:

```ts
// server (partyGame.ts), copied by hand into usePartyDisplay.ts
export interface PartyRoundPoint {
  id: number;
  name: string;
  points: number; // net for the current song, never 0
}
// PartyGameState gains:
roundPoints: Record<number, number>; // player id -> net points this song
// PartyDisplayState gains roundPoints: PartyRoundPoint[]
// PartyDisplayState.buzz becomes { answering: string | null }
```

Memory only, like all party state: no schema change, and party play still never
writes `ReviewLog`, `Card`, or `CardTrack`.

## Testing

- Vitest is on. Step 1 extends `partyGame.test.ts`; Step 2 adds
  `partyScoreSettle.test.ts`. The composable's timer and the components ride on
  browser evidence (`bun run build`, then `bun run party`, with the host panel
  and display side by side).

## Notes for the AI

- The display never learns an answer early: `roundPoints` names players only,
  so it is safe in any phase.
- `adjust` can be negative; the panel shows negative net totals in `--fail`
  color, but only rises pop.
- Keep `SCORE_SETTLE_MS = 2000` and the pop duration as named constants.
- Colors and sizes come from `main.css` tokens; reuse the `.kai-banner`
  classes for the pop, and `clamp(..vw..)` sizing like the other overlays.
- Keep `PartyRoundPoints` self-contained (its own positioned root), since 91b
  wraps each floating piece in a movable frame.
