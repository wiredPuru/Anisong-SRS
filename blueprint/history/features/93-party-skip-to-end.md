# Party: Skip to end

**Type:** Feature (build-plan item 93)
**Status:** verified

## Goal

A "Skip to end" button in the party host panel's Now playing that jumps the
current song to its last 3 seconds, with a brief "Skipping..." indicator on the
display so the room can see why the picture just jumped. Host-only and
in-memory like the rest of party mode.

## In scope

- Host: a "Skip to end" button in `PartyNowPlaying.vue` beside the transport
  buttons, and an `E` hotkey (listed in the `?` help).
- Display: a short "Skipping..." fast-forward overlay (about 1.5s) over the
  picture. It carries no title, artist, or other answer.
- Works while paused, playing, buzzed in, and during lightning rounds.

## Out of scope

- A configurable jump length (fixed 3 seconds).
- Any change to the Study screen, scoring, or the lightning timing rules.
- Phones: the player view is unchanged.
- Persisting anything; no schema change, and party play never writes
  `ReviewLog`, `Card`, or `CardTrack`.

## Decisions (made at intake)

- **No new jump logic.** The button sends the existing `seek` command with
  `seconds = max(0, duration - 3)`, using the duration the display already
  reports in its position (`state.position.duration`). The button is disabled
  until a duration is known, like the seek bar.
- **Indicator rides the seek.** `seek` gains an optional `skip: true`. When set
  the model also bumps `skipSeq`, a counter that, like `seekSeq`, only
  increases and is not reset by moving songs. The display shows the overlay
  when `skipSeq` changes (never on first load), so a reconnecting display does
  not replay it.
- **Lightning rounds allowed.** Skipping makes the clip reach its end sooner;
  lightning's `elapsed` clock still counts only real play time, so it reveals
  on its own schedule. Nothing in `lightningStep` changes.
- **Short clips.** A clip of 3 seconds or less seeks to 0.

## Build steps

- [x] 1. **Model + server.** `skip` on the `seek` command (`parsePartyCommand`
  accepts an optional boolean, rejects other types), `skipSeq` on
  `PartyGameState`, the display state, and `initialPartyState`, bumped by a
  skip seek and carried through End game like `seekSeq`. Tests in
  `partyGame.test.ts`: a skip seek sets `seekTo` and bumps both counters, a
  plain seek leaves `skipSeq`, a non-boolean `skip` is rejected, and no
  display field leaks an answer.
  **Done when:** `bun run test` passes with those cases and the display state
  JSON for a guessing song contains `skipSeq` and no answer fields.
- [x] 2. **Host button + hotkey.** `PartyNowPlaying.vue` button (disabled with
  no duration or no game), `usePartyHotkeys.ts` `E` entry plus its
  `PARTY_HOTKEYS` help row, and a pure helper for the target time
  (`max(0, duration - 3)`, rounded to 0.1s) with a unit test.
  **Done when:** with a song loaded the button sends `seek` with `skip: true`
  at `duration - 3`; the helper test covers a long clip, a 2s clip, and an
  unknown duration.
- [x] 3. **Display indicator.** The display composable carries `skipSeq`;
  `PartyDisplayPlayer.vue` (or `PartyDisplayOverlays.vue`) shows a "Skipping..."
  fast-forward overlay for about 1.5s when `skipSeq` changes, styled with
  existing tokens, no inline styles, and suppressed under
  `prefers-reduced-motion` except for the text itself.
  **Done when:** in a running party, pressing Skip to end shows the overlay on
  `/party/display`, the clip is within its last 3 seconds, and a page reload on
  the display shows no overlay.

## Files and areas

- Server: `server/utils/partyGame.ts` (+ test), the host command route needs no
  change.
- Client: `app/components/party/PartyNowPlaying.vue`,
  `app/composables/usePartyHotkeys.ts`, `app/composables/usePartyDisplay.ts`,
  `app/components/party/PartyDisplayPlayer.vue` or `PartyDisplayOverlays.vue`,
  `app/pages/party/display.vue` if the prop must be threaded.
- A small pure helper next to the host composable or in `app/utils/`, with a
  `*.test.ts` beside it.

## Contracts (load-bearing)

- `PartyCommand` `seek`: `{ type: "seek"; seconds: number; skip?: boolean }`.
- `PartyGameState.skipSeq` and `PartyDisplayState.skipSeq`: `number`, starts at
  0, only increases.

## Testing

Logic (command parsing, the reducer's `skipSeq`, the target-time helper) gets
Vitest tests per the project gate. The button, hotkey, and overlay are UI and
ride on build plus browser evidence from `bun run party`.

## Notes for the AI

- Follow feature 86/90's patterns: a command in `partyGame.ts`, state derived
  into the display view, and no answer or path reaching the display before
  reveal.
- Keep each step's diff small; do not touch lightning timing.
- Update `project-overview.md`'s item 93 entry from "not yet built" when
  `/complete` runs.
