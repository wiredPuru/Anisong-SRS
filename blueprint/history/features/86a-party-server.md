# Feature: Party server, two ports, and host password

**From build-plan:** feature 86a (parent: 86, Guess the Anime party mode)
**Status:** verified
**Branch:** `feature/86a-party-server`

## Goal

Stand up the skeleton every later party sub-feature builds on: a `gaq-party`
program that runs the built app on an internal loopback port behind two front
doors, a display port and a password-locked control port, with placeholder
pages on each. After this, `bun run party` (and the packaged `gaq-party`
binary) starts, the host can set a password from the host machine and log in
from a phone on the same Wi-Fi, and the display page shows a waiting screen.
There is no game yet.

## In scope

- `launcher/party.ts` and a `bun run party` script (after `bun run build`,
  like `bun run launch`).
- Shared server-environment setup extracted out of `launcher/index.ts`, so
  both launchers set the data dir, migrations, kuromoji, and the compiled-binary
  asset path the same way.
- Two `Bun.serve` front doors proxying to the internal Nitro server:
  - **Display door** - `127.0.0.1`, default port 4000.
  - **Control door** - `0.0.0.0`, default port 4001.
  - Each allows only its own paths and stamps two headers the app trusts:
    which door the request came through, and the client's IP.
- A Nitro middleware that hides every party route unless the process is the
  party server, and requires a host session on control routes other than
  status and login.
- The host password: a `party_host` singleton table, a scrypt hash
  (`node:crypto`), in-memory login sessions, and per-IP login rate limiting.
- Setting or replacing the password only from the host machine (a loopback
  client). Logging in works from anywhere on the LAN.
- Placeholder pages: `/party/display` (a waiting screen with Kai) and
  `/party/host` (setup, login, or a logged-in placeholder showing the display
  and LAN URLs and a Log out button).
- Packaging: `bun run package` also compiles `gaq-party` into every target
  and zip. The one-click update (feature 82) carries it along when the staged
  release contains it.

## Out of scope

- Game state, queue, the SSE stream, clip tokens, playback, reveal (86b, 86c).
- Screen effects, lightning rounds, timers, scoreboard, hotkeys (86d-86f).
- Changing the password from a LAN device, "forgot password" flows, HTTPS,
  and persisting sessions across restarts. The host resets the password by
  opening the host panel on the host machine.
- Proxying `nuxt dev` or HMR. Party development runs against `bun run build`
  output, the same as `bun run launch`.
- Any change to the SRS itself: routes, pages, and behaviour on port 3000 are
  untouched, apart from party routes 404ing there.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Shared launcher environment** - move the env setup,
  compiled-binary detection, and the `_importMeta_` asset-path fix out of
  `launcher/index.ts` into `launcher/serverEnv.ts`. `index.ts` keeps its
  port, self-update, browser-open, and cleanup behaviour. *Done when:*
  `bun run build && bun run launch` opens the SRS as before, and
  `bun run test` passes.
- [x] **Step 2 - Password storage and auth logic** - migration
  `0024_party_host` and a `partyHost` table. `server/utils/partyAuth.ts`
  holds:
  - `hashPassword`/`verifyPassword` (scrypt, random salt, `timingSafeEqual`)
  - `isLoopbackAddress`
  - an in-memory session store (random token, 12h expiry)
  - a login rate limiter (5 failures per IP per 60s, then refused until the
    window passes)
  - `getPartyPasswordHash`/`setPartyPasswordHash` (built in a separate
    `server/utils/partyHost.ts`, so the pure auth logic tests without a
    database)

  Tests beside it. *Done when:* the migration applies on boot, and the tests
  cover hash round-trip, wrong password, loopback forms (`127.0.0.1`, `::1`,
  `::ffff:127.0.0.1`, a LAN IP), session expiry (fake timers), and the limiter
  window.
- [x] **Step 3 - Party gate middleware and auth routes** -
  `server/middleware/party.ts`:
  - 404s `/party/**` and `/api/party/**` unless `GAQ_PARTY=1` and the request
    carries a door header.
  - On the control door, requires a valid session cookie for every
    `/api/party/**` route except status and login.

  Routes:
  - `GET /api/party/status`
  - `POST /api/party/login`
  - `POST /api/party/logout`
  - `POST /api/party/password` (loopback only; creates or replaces the
    password and logs that client in)
  - `GET /api/party/host/ping` (session only, `{ ok: true }`: proves the
    gate, and lets the host page check its login)

  The route-access rules are pure (`server/utils/partyAccess.ts`, tested);
  the singletons and cookie helpers sit in `server/utils/partySession.ts`.

  Party pages are client-rendered (`routeRules: { "/party/**": { ssr: false } }`),
  so no server-side fetch has to forward the door headers. *Done when:*
  through `curl` against a server started with `GAQ_PARTY=1` and hand-set
  headers:
  - status reports `hasPassword: false`
  - password set from a loopback IP returns 200, and from a LAN IP returns 403
  - login returns a session cookie, and the sixth bad login in a minute
    returns 429
  - a session-only route without the cookie returns 401

  Without `GAQ_PARTY`, `/party/host` and `/api/party/status` return 404 on the
  normal SRS.
- [x] **Step 4 - Party launcher with two front doors** - `launcher/party.ts`
  and the `"party"` package script:
  - Sets `GAQ_PARTY=1` and imports the built server on an internal
    `127.0.0.1` port.
  - Starts both `Bun.serve` doors. Each overwrites the door and client-IP
    headers from `server.requestIP()`, never trusting incoming ones, and
    applies its allowlist (`launcher/partyDoors.ts`, pure, tested). `/` sends
    each door to its own page.
  - Prints the display URL and every LAN control URL, then opens the control
    URL in the browser.
  - Ports can be overridden with `GAQ_PARTY_DISPLAY_PORT`,
    `GAQ_PARTY_CONTROL_PORT`, and `GAQ_PARTY_INTERNAL_PORT`.

  *Done when:*
  - `bun run party` prints the URLs.
  - Display-door paths outside its allowlist (for example `/cards` and
    `/api/cards`) return 404.
  - On the control door, `/api/cards` returns 404 and `/api/party/status`
    answers.
  - The display port does not answer on the machine's LAN IP.
  - The allowlist tests pass.
- [x] **Step 5 - Placeholder pages** - a blank `party` layout (no rail), plus
  two pages:
  - `/party/display` - Kai with a "Waiting for the host" message, full-window,
    in the app's theme.
  - `/party/host` - driven by status:
    - no password on a loopback client: a set-password form
    - no password from the LAN: a message to set it on the host machine
    - logged out: a login form, with the rate-limit error shown
    - logged in: a placeholder listing the display URL and LAN control URLs,
      and a Log out button
    - on the host machine, the login form also offers "Set a new password"
      (the recovery path for a forgotten one)

  *Done when:* screenshots show all four host states and the display page. A
  phone on the same Wi-Fi can log in at the printed LAN URL, and a
  refresh keeps it logged in.
- [x] **Step 6 - Package and update the second binary** -
  `scripts/package.ts` compiles `launcher/party.ts` as `gaq-party` /
  `gaq-party.exe` into each target folder beside `gaq-srs`, ad-hoc signs it on
  macOS like the SRS binary, and includes it in the zip.
  `checkStagedLayout` accepts an optional party binary, and the update restart
  adds it to the swap items only when the staged release has it, as an
  `optional` swap item: installs from before 86a have no `gaq-party` to move
  aside, so it is added rather than replaced, and removed again if the swap
  rolls back. *Done when:*
  - `bun run package` produces zips holding both binaries, and the macOS
    `codesign --verify` passes for both.
  - Double-clicking the macOS `gaq-party` starts both doors.
  - A staged-layout test covers releases with and without the party binary.

## Files / areas

- `nuxt-app/launcher/serverEnv.ts` (new), `launcher/index.ts` (slimmed)
- `nuxt-app/launcher/party.ts`, `launcher/partyDoors.ts` (+ test) (new)
- `nuxt-app/server/db/schema.ts`, `server/db/migrations/0024_party_host.sql`
  (+ meta)
- `nuxt-app/server/utils/partyAuth.ts` (+ test) (new)
- `nuxt-app/server/middleware/party.ts` (new)
- `nuxt-app/server/api/party/status.get.ts`, `login.post.ts`,
  `logout.post.ts`, `password.post.ts` (new)
- `nuxt-app/app/layouts/party.vue`, `app/pages/party/display.vue`,
  `app/pages/party/host.vue` (new)
- `nuxt-app/nuxt.config.ts` (party route rule)
- `nuxt-app/package.json` (`party` script)
- `nuxt-app/scripts/package.ts`, `server/utils/selfUpdate.ts` (+ test)
- `AGENTS.md` Commands: `bun run party`

## Data / contracts

Load-bearing for 86b-86f:

- **Table `party_host`** - singleton, `id` always 1:
  - `passwordHash` (text, not null, `scrypt$<saltHex>$<hashHex>`)
  - `updatedAt` (datetime)
- **Door headers**, set only by the front doors, which overwrite anything
  incoming:
  - `x-gaq-party-door: display | control`
  - `x-gaq-party-client-ip: <ip>`

  Nitro listens on loopback only, so a request carrying these came through a
  door or from the host machine itself.
- **Session cookie**: `gaq_party_session` (HttpOnly, SameSite=Strict, Path=/,
  12h). Sessions live in memory and end on restart.
- **Route namespaces**:
  - `/api/party/display/**` - display door only, no session (86b adds the SSE
    stream here).
  - `/api/party/host/**` - control door only, session required.
  - `/api/party/{status,login,logout,password}` - control door.
- **`GET /api/party/status`** returns
  `{ hasPassword: boolean; loggedIn: boolean; isLoopback: boolean; displayUrl: string; controlUrls: string[] }`.
  The launcher passes the URLs in env (`GAQ_PARTY_DISPLAY_URL`,
  `GAQ_PARTY_CONTROL_URLS`).
- **Env**:
  - `GAQ_PARTY=1` (party process only)
  - `GAQ_PARTY_DISPLAY_PORT` (4000)
  - `GAQ_PARTY_CONTROL_PORT` (4001)
  - `GAQ_PARTY_INTERNAL_PORT` (4002)
- **Password rules**: at least 6 characters. Only a loopback client may set or
  replace it.

## Testing

Vitest is configured, so the logic gate is on:

- `partyAuth.test.ts` - hash and verify, loopback detection, session expiry,
  and the rate-limit window (`vi.useFakeTimers()`).
- `partyDoors.test.ts` - each door's allowlist: allowed and refused paths, and
  root redirects.
- `selfUpdate` staged-layout test - releases with and without `gaq-party`.

Integration rides on `curl` evidence (Step 3), the launcher's printed URLs
plus a LAN-IP probe (Step 4), screenshots of the pages (Step 5), a real
phone login, and `bun run package` output (Step 6). Run `bun run test` and
`bun run build` before each approval.

## Notes for the AI

- Keep security proportionate. This runs on a home or venue LAN, so the
  password, loopback-only setup, rate limit, and allowlists are the whole
  model. Don't add HTTPS, CSRF tokens, or account systems.
- Use `node:crypto` scrypt, not `Bun.password`: `bun run dev` runs Nitro
  under Node and Vitest runs in Node, so a Bun-only API would break both. The
  build-plan line mentions `Bun.password`; correct it at `/complete`.
- The SRS launcher must keep binding `127.0.0.1` only, and SRS routes must stay
  unauthenticated and unchanged. The party gate must 404 party routes in the
  normal SRS process, not just skip auth there.
- The party launcher does not set `GAQ_SRS_INSTALL_DIR`, so the party process
  never offers self-update, and it does not run update-leftover cleanup.
- Both processes can run at once against the same SQLite file. Party
  sub-features only read the library.
- Follow the established launcher comment style (explain compiled-binary
  quirks), the query-param or body-id route convention, and scoped styles
  with `var(--token)` in the party pages.
