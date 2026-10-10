# 102a. Party kick

**Type:** Feature (sub-feature 1 of 2 of build-plan item 102, Party kick and IP ban)

**Status:** verified

## Goal

The host can kick a disruptive player. Today the scoreboard's `✕` only drops
the row (`score remove`): the phone gets a quiet "The host removed you" note on
the same join form and can rejoin in one tap, and nothing marks it as a
moderation action. A kick is a deliberate, confirmed host action that signs the
phone out at once and shows it a clear "removed" screen.

Rejoining is still possible after a kick (that is what 102b's ban prevents).

## In scope

- Host: a **Kick** button per joined player in `PartyScoreboardPanel`, behind
  an inline two-step confirm ("Kick Aki? They can rejoin until you ban them.").
  The existing `✕` stays as the roster-tidying remove.
- Server: `kick(playerId)` on the player registry: revoke every session token
  for that player, close their open player streams, then drop them from the
  scoreboard (`score remove`). Host route `POST /api/party/host/kick`
  `{ id }` (400 for a non-id, 404 for an unknown player).
- Phone: a kicked phone shows a "You were removed by the host" screen with a
  **Join again** button (clears the notice, back to the name form), instead of
  silently returning to the form. A party restart still shows the existing
  "game restarted" note, and a plain `✕` remove keeps today's note.
- Round state follows the existing remove rules (a buzz held by the kicked
  player is released, their award rows leave with them).

## Out of scope (102b)

IP recording, the ban list, refusing join or stream by IP, and the Banned UI.

## Build steps

- [x] **Server kick.** `kick` in `partyPlayers` (revoke sessions, close
  streams, apply `score remove`), `POST /api/party/host/kick`, and a unit test
  on the registry: kick revokes the token, a second kick of the same id is a
  no-op, and the stream close callback runs. Done when `bun run test` is green
  and a kicked player's `GET /api/party/player/me` returns 401.
- [x] **Phone "removed" screen.** The stream tells the phone why it was
  dropped (a dedicated named SSE event, so `PartyPlayerState` gains no field),
  and `play.vue` shows the removed screen with Join again. Done when a kicked
  phone shows the screen within a second and Join again returns to the form.
- [x] **Host Kick button.** Per-player Kick with inline confirm in
  `PartyScoreboardPanel.vue` calling the new route. Done when the host kicks a
  joined test player, the row disappears, and the phone shows the screen.

## Data and contracts

- No schema change. In-memory only, like all party state.
- New route: `POST /api/party/host/kick` `{ id: number }` -> `{ ok: true }`.
  Host-session gated by the existing `/api/party/host/**` middleware rule.
- Load-bearing for 102b: `kick` lives on the player registry, which is also
  where the ban step will add the IP to the ban list.

## Testing

- Unit (Vitest, next to `partyPlayers.ts`): registry kick behavior above.
- UI and the SSE notice ride on browser evidence: join as a player in one tab,
  kick from the host panel, see the screen.

## Notes for the AI

- Sessions and streams live in `server/utils/partyPlayers.ts`; the stream route
  is `server/api/party/player/stream.get.ts` via `streamPartyView`.
- Party play never writes `ReviewLog`, `Card`, or `CardTrack`.
- Keep the phone view free of anything that leaks an answer.
- No em dashes in code, comments or docs.
