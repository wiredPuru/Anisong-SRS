# Feature: Player door and joining

**From build-plan:** feature 90a (parent: 90, Party players and buzzer)
**Status:** verified

## Goal

Let people in the room join a `gaq-party` game from their phones. A third LAN
port serves only a player page, gated by a room code shown on the display. A
player enters the code and a name once; the phone remembers them, and they
appear on the host's scoreboard. This is the foundation 90b's buzzer builds on.
It adds no buzzing yet.

## In scope

- A `player` door on `0.0.0.0:4003` (`GAQ_PARTY_PLAYER_PORT`) in
  `launcher/party.ts`, with its own allowlist: `/party/play`,
  `/api/party/player/*`, and the shared assets. `/` redirects to
  `/party/play`. The launcher prints the player addresses and passes them to
  the app as `GAQ_PARTY_PLAYER_URLS`.
- Server access rules for the player door (`partyAccess.ts`): the page and
  `join` are public; every other `/api/party/player/*` route needs a player
  session; nothing else is reachable. The existing doors are unchanged, and the
  control and display doors cannot reach `/api/party/player/*`.
- A room code: 4 letters from an unambiguous alphabet (no I, L, O), made when
  the party server starts. The host can generate a new one. A new code does not
  sign anyone out.
- Player sessions: an in-memory token -> player id map with an httpOnly
  `gaq_party_player` cookie. A session ends when its player is removed or the
  party process stops.
- Joining (`POST /api/party/player/join` `{ code, name }`):
  - The code check is case-insensitive.
  - A name is trimmed and must be 1-24 characters.
  - A name already held by a connected phone player is refused (409).
  - A name matching a host-added player, or a phone player that has
    disconnected, claims that player and keeps its score. That lets the host
    type names in ahead of time.
  - Otherwise it adds a new player, up to the existing 20-player cap (409
    "The game is full").
  - A wrong code counts toward a limit of 5 failures per IP per minute (429).
  - A phone that already has a valid session gets its player back, not a
    second one.
- `GET /api/party/player/me` returns `{ player: { id, name, score } | null }`.
- `POST /api/party/player/name` `{ name }` renames yourself, with the same rules
  as joining.
- `GET /api/party/player/stream` (SSE):
  - It sends the player view: your player (or `null` once removed), the phase,
    the song number and total, and the ranked scoreboard names and scores.
  - It never carries an answer, a clip token, or a card id.
  - Holding it open is what marks the player connected; closing it marks them
    disconnected.
- `PartyPlayer` gains `phone: boolean` and `connected: boolean`. Host-added
  players are `phone: false`, `connected: false`.
- The `/party/play` page:
  - a join form (code prefilled from `?code=`, name prefilled from
    `localStorage`)
  - after joining, a waiting screen with the player's name, score, and song
    progress, and a Change name action
  - clear states for a wrong code, a full game, a taken name, being removed
    by the host, and a lost connection that retries by itself
- Host panel:
  - the scoreboard marks phone players, with a connected dot
  - removing a phone player ends their session
  - a "Players join at" block shows the player addresses, the room code, and
    a New code button
- Display:
  - with no game loaded, the idle screen shows the join address and room
    code large
  - during a game, a small corner chip shows the same, which the host can
    hide or show (`joinInfoVisible`, default shown, kept across End game)

## Out of scope

- Buzzing, buzzer mode, and any phone controls beyond joining and renaming
  (90b).
- Awarding points from the phone or on reveal (90c). Scores still change only
  through the host's existing scoreboard controls.
- Showing the answer on phones. That comes with 90b's reveal state.
- QR codes, per-player passwords or accounts, and persisting players across a
  party restart.
- Any change to the SRS (`gaq-srs`) or its port.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The player door** - `launcher/partyDoors.ts` gains a `player`
  door: `DOOR_HOME.player = "/party/play"`, and `decideDoorRequest` proxies
  only `/party/play`, `/api/party/player/*`, and shared assets, redirecting `/`.
  The control door's `/api/party/*` rule excludes `/api/party/player/` as it
  already excludes `/api/party/display/`. `partyAccess.ts` accepts `"player"`
  in `parsePartyDoor` and returns `public` for `/party/play` and
  `/api/party/player/join`, `player` (a new access kind) for other
  `/api/party/player/*` routes, and `notFound` for everything else on that door
  and for `/api/party/player/*` on the other two. `server/middleware/party.ts`
  treats `player` as 401 "Join the game first" when there is no valid player
  session. The session check is a stub that always fails until step 3.
  `launcher/party.ts` serves the door, reads `GAQ_PARTY_PLAYER_PORT`
  (default 4003), prints the LAN player URLs, and sets
  `GAQ_PARTY_PLAYER_URLS`. `AGENTS.md`'s party command entry lists the new port
  and env var. *Done when:* `partyDoors.test.ts` and `partyAccess.test.ts` cover
  the player door, the player API refused on the display and control doors,
  and the host page refused on the player door; `bun run build`, then
  `bun run party` with `GAQ_SRS_SKIP_BROWSER=1`, prints the player URL, and
  `curl` shows `/party/host` is a 404 on port 4003 while
  `/api/party/player/me` there answers 401.
- [x] **Step 2 - Players in the game model** - in `partyGame.ts`,
  `PartyPlayer` gains `phone` and `connected`. The `score` `add` op creates
  `phone: false, connected: false`. New internal commands, not accepted by
  `parsePartyCommand` from the host route:
  - `{ type: "playerJoin"; name; claimId? }` adds a phone player or claims an
    existing one
  - `{ type: "playerConnection"; id; connected }`

  A host command `{ type: "joinInfo"; visible }` shows or hides the display's
  corner chip, stored as `joinInfoVisible` and kept across `clear`. A pure
  `planJoin(players, name)` returns `{ claimId } | { add: true } |
  { error: "taken" | "full" | "invalid" }` using the rules in In scope.
  `toHostState` carries the new fields. `toDisplayState` takes the join info
  as an argument and sets `join: { code; urls } | null`, filled when there is
  no game or `joinInfoVisible` is on. A new `toPlayerState(state, playerId)`
  builds the player view, with no answer, token, or card id. *Done when:*
  `partyGame.test.ts` covers `planJoin` (new, claim host-added, claim
  disconnected phone player, refuse connected duplicate case-insensitively,
  full, blank and too-long names), the connection toggle, `joinInfoVisible`
  surviving `clear`, `playerJoin` refused by `parsePartyCommand`, and
  `toPlayerState` leaking no answer even while revealed.
- [x] **Step 3 - Room code, sessions, and the player API** - a new
  `server/utils/partyPlayers.ts` holds the room code (`generateRoomCode`,
  `regenerateRoomCode`), the token -> player id session map (a token whose
  player no longer exists is invalid), and a join limiter from
  `createLoginLimiter`. `partySession.ts` gets `getPlayerSession(event)`, used
  by the middleware in place of step 1's stub. Routes:
  - `POST /api/party/player/join`
  - `GET /api/party/player/me`
  - `POST /api/party/player/name`
  - `GET /api/party/player/stream`, which commits `playerConnection` on open
    and close, counting open streams per player so a second tab doesn't flip
    the player offline when one closes
  - host `GET /api/party/host/join-info` and `POST /api/party/host/room-code`,
    both returning `{ code, urls }`

  The display stream passes the code and `GAQ_PARTY_PLAYER_URLS` into
  `toDisplayState`. *Done when:* tests cover code generation (alphabet,
  length), code comparison, session validity after removal, the join rules
  through a `joinPlayer(code, name, existingToken)` function (wrong code
  counted, limiter blocking, rejoin with a live token, claim, full, taken), and
  a `curl` session against `bun run party` joins, reads `/me`, and is refused
  a duplicate name from a second session.
- [x] **Step 4 - The player page** - `app/pages/party/play.vue` (client-only,
  on the rail-less `party` layout) with a `usePartyPlayer` composable over the
  player stream. It shows the join form, then the waiting screen, plus the
  error, removed, and reconnecting states from In scope. Phone-first layout
  using existing tokens and `MascotKai`. *Done when:* screenshots at 390x844
  in both themes show the form, a wrong-code error, the waiting screen after
  joining through the player port, and the removed state after the host removes
  the player. A reload keeps the player in without the form.
- [x] **Step 5 - Host panel and display** - `PartyScoreboardPanel` shows a
  phone mark and a connected dot for phone players. A new `PartyJoinPanel` on
  the host dashboard shows the player addresses, the room code, New code, and
  the display chip toggle. The display's idle screen shows the join address and
  code large, and `PartyDisplayOverlays` shows the corner chip during a game
  while `join` is set. *Done when:* screenshots show the host scoreboard with a
  connected and a disconnected phone player, the join panel, the idle display
  with join info, and the corner chip on a playing display. New code changes
  the code on the display without signing out a joined phone.

## Files / areas

- `nuxt-app/launcher/party.ts`, `nuxt-app/launcher/partyDoors.ts` (+ test)
- `nuxt-app/server/utils/partyAccess.ts` (+ test), `nuxt-app/server/middleware/party.ts`, `nuxt-app/server/utils/partySession.ts`
- `nuxt-app/server/utils/partyGame.ts` (+ test), `nuxt-app/server/utils/partyStore.ts`
- `nuxt-app/server/utils/partyPlayers.ts` (new, + test)
- `nuxt-app/server/api/party/player/{join.post,me.get,name.post,stream.get}.ts` (new), `nuxt-app/server/api/party/host/room-code.post.ts` (new), `nuxt-app/server/api/party/display/stream.get.ts`
- `nuxt-app/app/pages/party/play.vue` (new), `nuxt-app/app/composables/usePartyPlayer.ts` (new)
- `nuxt-app/app/components/party/PartyScoreboardPanel.vue`, `PartyJoinPanel.vue` (new), `PartyHostDashboard.vue`, `PartyDisplayOverlays.vue`, `nuxt-app/app/pages/party/display.vue`, `nuxt-app/app/composables/usePartyHost.ts`, `usePartyDisplay.ts`
- `AGENTS.md` (party command entry)

## Data / contracts

All in memory. There are no schema changes, and party play still never writes
`ReviewLog`, `Card`, or `CardTrack`.

- `PartyPlayer { id; name; score; phone: boolean; connected: boolean }`.
  **Load-bearing for 90b-90d**, which key buzzes and awards on `id`.
- `PartyGameState` gains `joinInfoVisible: boolean`.
- `PartyDisplayState` gains `join: { code: string; urls: string[] } | null`.
- `PartyPlayerState` (the player stream), **load-bearing for 90b**, which adds
  buzz fields to it:
  ```ts
  { version: number; me: { id: number; name: string; score: number } | null;
    phase: PartyPhase; song: { number: number; total: number } | null;
    players: { name: string; score: number }[] }
  ```
- Player routes: `POST join { code, name }` -> `{ player }` (400 invalid, 401
  wrong code, 409 taken or full, 429 limited); `GET me`; `POST name { name }`;
  `GET stream`. Host: `POST room-code` -> `{ code }`.
- Cookie `gaq_party_player`: httpOnly, `sameSite: strict`, `path: /`, expiring
  when the browser session ends.
- Env: `GAQ_PARTY_PLAYER_PORT` (default 4003), `GAQ_PARTY_PLAYER_URLS` (set by
  the launcher).

## Testing

Vitest is on:

- Step 1: door and access rules (`partyDoors.test.ts`, `partyAccess.test.ts`).
- Step 2: `planJoin`, the new reducer commands, and `toPlayerState` in
  `partyGame.test.ts`.
- Step 3: room code, session map, and `joinPlayer` in `partyPlayers.test.ts`.

Steps 4-5 are UI and ride on browser evidence (`playwright-cli` against
`bun run party` on a scratch data dir, phone-size and desktop screenshots in
both themes) plus `bun run build`. Steps 1 and 3 also carry a `curl` run
against the real doors, since door routing lives in the launcher.

## Notes for the AI

- Security boundary: the player door is unauthenticated apart from the room
  code, and it faces the LAN. Only the routes listed are reachable. The player
  view is built by its own function, never by trimming the host view. A test
  asserts no answer, token, or card id appears in it. Keep the check
  proportionate (see memory: basics only).
- Like the other doors, the launcher overwrites `x-gaq-party-door` and
  `x-gaq-party-client-ip`. The player door must do the same.
- `playerJoin` and `playerConnection` go through a store-level helper, not
  through `parsePartyCommand`, so the host command route can never forge a
  phone join.
- A connection change bumps the version, so the host and display streams update.
  The display only shows names and scores, and its view skips a send when
  unchanged.
- The room code lives in `partyPlayers.ts`, not in `PartyGameState`, so the
  host state (and anything logged from it) never needs it. The display gets it
  through `toDisplayState`'s argument.
- Use the existing 5-failure-per-minute limiter shape for joins rather than a
  new mechanism.
- Copy uses plain hyphens and no em dashes. Phone copy stays short.

## As built

- The player door and its rules match the spec. Beyond the spec, the host has
  `GET /api/party/host/join-info` as well as `POST /api/party/host/room-code`,
  both returning `{ code, urls }`, so the join panel can show the code on load.
- `partyPlayers.ts` exports `createPlayerRegistry` (room code, token -> player
  id sessions, the join limiter, and per-player open-stream counts), and
  `partyStore.ts` holds the one instance as `partyPlayers`. Claiming a player
  revokes the old phone's tokens, so a player never has two phones.
- A new room code bumps the game version, so every display stream sends a
  fresh view even though the code is not part of `PartyGameState`.
- `streamPartyView` gained an optional `onClosed` callback, which the player
  stream uses to mark the player disconnected.
- Removing a player needs no session cleanup: a token is only honoured while
  its player id is still on the scoreboard, and ids are never reused.
- The phone page tells a party restart apart from a network drop by asking
  `/me` after the stream closes. A restart sends the phone back to the join
  form with a "The game restarted" notice.
- The display's in-game chip shows the first LAN address only; the idle screen
  and the host panel list all of them.
- Evidence came from `bun run party` on a scratch data dir:
  - `curl` checks for every door route
  - a curl join session: wrong code 401, lowercase code accepted, duplicate
    name 409, and disconnect on stream close
  - phone screens at 390x844 (join form, wrong code, taken name, joined in
    dark, and removed by the host)
  - host panel and display screenshots, including New code updating the
    display chip without signing the phone out
