# Feature: Party IP ban (102b)

**From build-plan:** feature 102b (second sub-feature of 102, Party kick and IP ban)
**Status:** complete

## Goal

The host can ban a disruptive player's network address, so kicking them cannot
be undone by rejoining. A ban signs the player out, refuses that address at the
player door until the host unbans it, and shows the phone a clear "you can't
join" screen. Bans live in memory and clear when `gaq-party` restarts.

An IP ban is a deterrent, not a guarantee: a banned person can switch networks.
Phones behind one shared address (a hotspot, one router with NAT) are banned
together, and the host UI says so before confirming.

## In scope

- Record each player's address at join (the door-stamped
  `x-gaq-party-client-ip` header, normalised), refreshed on every join or claim.
- A ban list on the player registry: `ban(playerId)` bans the player's address
  and kicks every player recorded from it (so the scoreboard has no ghosts);
  `unban(ip)` removes it.
- Refusal: every `/api/party/player/*` request from a banned address answers
  `403` (join, stream, me, name, buzz, choice), checked in the party middleware.
- Host routes: `GET /api/party/host/moderation`, `POST /api/party/host/ban`
  `{ id }`, `POST /api/party/host/unban` `{ ip }`.
- Host UI in `PartyScoreboardPanel`: a **Ban** button next to Kick with an
  inline confirm that names the address and how many other players share it,
  and a **Banned** list with **Unban**.
- Phone: a "You can't join this game" screen (no Join again) shown when join,
  `/me` or the stream answers `403`.

## Out of scope

- Persisting bans across restarts, ban expiry, banning by name or cookie, and
  CIDR or range bans.
- Display and control doors: the ban only gates the player door's API.
- Showing a player's address anywhere but the host panel.

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Address normalising and ban gate (pure).** `normalizeIp` in
  `server/utils/partyIp.ts` and `isBannedPlayerRequest(path, door, banned)` in
  `partyAccess.ts`, with tests. *Done when:* `bun run test` passes and the tests
  cover IPv4-mapped IPv6, brackets, zone ids, empty input, and only
  `/api/party/player/*` on the player door being gated.
- [x] **Step 2 - Registry bans.** In `partyPlayers.ts`: addresses recorded in
  `join`, `ipOf`, `ban`, `unban`, `isBanned`, `bans`, `addresses`; `join` refuses
  a banned address with `403`. Tests next to it. *Done when:* tests cover ban
  removing every player on that address, a banned join, unban, a claim moving
  the address, a missing address, and a repeat ban.
- [x] **Step 3 - Routes and gate.** Pass the client address into `join`, add the
  middleware check, and add the three host routes. *Done when:* with a party
  server running, curl as the player door from a test address gets `403` on every
  player route after a ban and `200` after an unban, and the host routes answer
  `401` without a host login, `404` for an unknown player, `409` for a player
  with no address.
- [x] **Step 4 - Phone banned screen.** `usePartyPlayer` gains a `banned` view
  on `403` from join, `/me` and stream recovery; `play.vue` shows it. *Done
  when:* in a browser, a banned phone shows the screen and no form.
- [x] **Step 5 - Host UI.** Ban with confirm and the Banned list with Unban in
  `PartyScoreboardPanel.vue`. *Done when:* the host bans a joined test player,
  the row goes, the confirm named the address and sharing count, the Banned
  list shows it, and Unban lets the phone join again.
- [x] **Step 6 - End-to-end proof.** No new code unless a bug turns up. With
  `bun run party` and `playwright-cli`, play through join, kick, ban, refused
  rejoin, unban, rejoin. *Done when:* the evidence in Testing is recorded and
  the console is clean.

## Files / areas

- New: `server/utils/partyIp.ts`, `partyIp.test.ts`,
  `server/api/party/host/ban.post.ts`, `unban.post.ts`, `moderation.get.ts`.
- Changed: `server/utils/partyPlayers.ts` (+ test), `partyAccess.ts` (+ test),
  `server/middleware/party.ts`, `server/api/party/player/join.post.ts`,
  `app/composables/usePartyPlayer.ts`, `app/pages/party/play.vue`,
  `app/components/party/PartyScoreboardPanel.vue`.

## Data / contracts

No schema change; in-memory only.

```ts
// partyPlayers registry additions
interface PartyBan { ip: string; name: string; bannedAt: number } // name = player's name when banned
ban(playerId: number): { ok: true; ip: string; removed: number }
                     | { ok: false; reason: "unknown" | "noAddress" };
unban(ip: string): boolean;
isBanned(ip: string | null): boolean;
bans(): PartyBan[];
addresses(): { id: number; ip: string | null; sharedWith: number }[];
```

- `join` result gains `{ ok: false; status: 403; message: "You can't join this game." }`.
- `GET /api/party/host/moderation` -> `{ bans: PartyBan[]; addresses: { id; ip; sharedWith }[] }`.
- `POST /api/party/host/ban` `{ id }` -> `{ ok: true, ip, removed }`; `400` bad id,
  `404` unknown player, `409` no address recorded.
- `POST /api/party/host/unban` `{ ip }` -> `{ ok: true }`; `404` not banned.
- Normalised address: lowercase, no brackets or `%zone`, `::ffff:a.b.c.d`
  becomes `a.b.c.d`; empty becomes `null`. Never trust a client-sent header: only
  the door's stamp is read (`getPartyClientIp`).
- Loopback addresses are bannable (a host testing on their own machine can
  unban); nothing is special-cased.

## Testing

- **Unit (Vitest):** everything in Steps 1 and 2.
- **Route and UI evidence (curl, then browser through the real `bun run party`
  doors on scratch ports and a scratch data directory; results):**

| Check | Result |
|---|---|
| Host routes without a host login | `401` (moderation, ban, unban) |
| Ban with a bad id, an unknown player, a phone with no address | `400`, `404`, `409` |
| Unban with a bad body, an address that is not banned | `400`, `404` |
| Ban a player: join, me, name, buzz, choice, stream from that address | `403` on all six |
| Same address written as `::ffff:a.b.c.d` | Refused and unbanned the same way |
| `/party/play` page from a banned address | `200`, so the phone can explain |
| Display door from a banned address | Unaffected |
| Two phones on one address (LAN address) and one on `127.0.0.1` | Host confirm named `192.168.50.183` and "1 other player is on it and will be removed too"; a ban removed both, the loopback phone stayed |
| Banned phones | "You were removed", then after a reload "You can't join this game" with no form |
| Direct join from the banned address vs another address | `403` vs `200` |
| Unban in the host panel | Banned list disappears; the phone reloads to the join form and joins |
| Ban, then restart `gaq-party` | The same address joins again (`200`) |
| Console | Only expected `401`s (checks before joining or logging in), the `403` that drives the banned screen, and cut streams when I stopped the server |

Browser: headless Chromium. The user's own running `gaq-party` was left alone.

## Notes for the AI

- Party play never writes `ReviewLog`, `Card` or `CardTrack`.
- Keep the phone view free of anything that leaks an answer, and never send an
  address to the display or player doors.
- No em dashes in code, comments or docs.
