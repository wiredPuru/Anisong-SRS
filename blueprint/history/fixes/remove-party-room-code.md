# Remove the party room code

**Type:** Fix
**Status:** verified

## The problem

Feature 90a gates the player door (`0.0.0.0:4003`) behind a 4-letter room code,
shown on the display and typed on each phone. The party runs on the host's own
machine for a room they are in, so the code is friction with no real benefit:
players should just open the join address and enter a name.

## The fix

Remove the room code end to end. A join takes a name only. Nothing else about
joining changes: name validation and uniqueness, reclaiming a name by rejoining,
the 20-player cap, the remembered session on the phone, and the host's
rename/remove controls.

- **Server:** drop `generateRoomCode`, `roomCodeMatches`, `ROOM_CODE_LENGTH`,
  `roomCode()` and `regenerateRoomCode()` from `partyPlayers.ts`; `join` no
  longer takes or checks `code`. The `POST /api/party/host/room-code` route and
  `regeneratePartyRoomCode` in `partyStore.ts` are deleted; `join-info` returns
  `urls` only. `join.post.ts` stops reading `code`.
- **Join rate limit:** it only counted wrong-code attempts, so with no code it
  has nothing to count. It is removed from the registry along with the 429
  result. Name validation errors (400/409) stay.
- **Display:** `PartyGameState`/display join shape loses `code`; the display's
  join chip (`PartyDisplayOverlays.vue`, `display.vue`'s `display-join-code`)
  shows only the address.
- **Host panel:** `PartyJoinPanel.vue` loses the Room code row and "New code"
  button.
- **Phone:** `play.vue` and `usePartyPlayer.join` drop the code field and the
  `?code=` query param; the join form is the name only and its note about the
  big-screen code goes.
- **Must not break:** a phone with a saved session still goes straight back in;
  the player door still serves only the player page and API; no answer reaches a
  player before the reveal.
- **Docs:** feature 90a's entry in `project-overview.md` and `project-plan.md`
  (§2/§3/§8/§9 mentions of the room code) updated to say joining is by name only,
  since this reverses a decision recorded at 90 intake. The "Players join" URL
  printed by `bun run party` and the `AGENTS.md` party line stay as they are
  except for any "room code" wording.

## Build steps

- [x] 1. Server and client removal as above, `partyPlayers.test.ts` updated
  (code and rate-limit cases deleted, name-only join cases kept).
  **Done when:** `bun run test` and `bun run build` pass, a grep for
  `roomCode`/`room-code`/`room code` under `nuxt-app/` (excluding build output)
  is empty, and joining with just a name works on `:4003`.
- [x] 2. Update the docs that mention the room code. **Done when:** a grep for
  "room code" in `blueprint/context/` and `blueprint/project-plan.md` finds only
  history/archive references.

## Verify

1. `bun run party`, open `http://127.0.0.1:4000/party/display`: the join chip
   shows the address and no code.
2. Open `http://<LAN ip>:4003` (or a second browser): the form asks for a name
   only; joining puts the player on the host scoreboard.
3. Reload the phone page: it goes straight back in. Join again with a taken name
   from another browser: "Someone is already using that name."
4. Host panel Join section shows the addresses with no code or "New code".
