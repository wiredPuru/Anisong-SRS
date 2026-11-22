# Party host: cover art fix + remove preview and censor

**Type:** Fix
**Status:** verified
**Branch:** `fix/party-host-cover-and-censor`

## The problem

1. **Cover art never shows on `/party/host`.** Every card's cover comes from
   `animeCoverUrl`, which returns the SRS's own `/api/anime/cover?id=` path
   whenever a copy is saved locally, and every anime with cards has one (1,289
   saved). The party doors 404 every non-party route, so the host's Now
   playing cover and the display's reveal card both fail. (The first guess,
   network mode staying unknown after login, was wrong: `plugins/networkMode.ts`
   re-checks every 5 seconds, so it recovers on its own.)
2. **The preview and censor feature is unwanted.** The host panel's "Preview
   and censor" section (a host-side preview player plus live and recorded
   censor boxes) is unnecessary and should be removed outright, server and
   display included.

## The fix

**Cover:**
- `servePartyCover` (`server/utils/partyCover.ts`) holds the token-based
  cover handler `/api/party/display/cover` already had, now also served at
  `GET /api/party/host/cover?t=` behind the host session.
- `partyCoverPath` (`server/utils/partyCoverPath.ts`, pure) gives
  `toHostState`'s queue answers and the display's revealed answer a cover path
  on their own door, by token. Remote and saved covers both go through it.

**Censor removal (everything below goes):**
- Host UI: `PartyCensorPanel.vue`, its dashboard section, censor entries in
  `partyHostActions`, `partyPalette` and `usePartyHotkeys` (`C`, `D`, the
  preview-lead read), and `app/utils/partyCensorBoxes.ts` and
  `app/utils/partyPreview.ts` with their tests.
- Display: censor props and rendering in `PartyDisplayPlayer.vue` and
  `display.vue`, censor fields in `usePartyDisplay`, and the `--censor-*`
  tokens in `main.css`.
- Server: `censor`, `censorStyle`, `censorRecord`, `censorForget` commands,
  the internal `censorSaved`, every `censor*` field on game state and the
  display/host views (`partyGame.ts`), the store's saved-track load and save
  (`partyStore.ts`), `partyCensor.ts`, `partyCensorStore.ts`, their tests,
  `server/api/party/host/clip.get.ts`, and the host state's `currentToken`
  (only the preview used either).
- Data: drop the `party_censor` table through a new Drizzle migration (not a
  hand edit), removing `partyCensor` from `schema.ts`.

**Must not break:** the display's own cover picture mode
(`/api/party/display/cover`), effects (blur, pixelate, blackout), lightning
rounds, reveal fields, the scoreboard and buzzer, and Study/Listen covers.
The three-column host revamp is a separate feature, not part of this fix.

## Build steps

- [x] **1. Host and display covers show.** The shared cover handler, the
  host cover route, and token cover paths in the host and display views.
  *Done when:* in a loaded game the host state's covers are
  `/api/party/host/cover?t=` paths that return an image with a session and
  `401` without, the revealed display answer's cover returns an image, and
  unit tests cover both views and the path builder.
- [x] **2. Remove censor from the host panel and display.** Client side only:
  components, utils, hotkeys, palette entries, display rendering, tokens.
  *Done when:* no `censor`/`partyPreview` reference remains under `app/`, the
  host panel has no Preview section, and the display still plays with effects
  working.
- [x] **3. Remove censor from the server and database.** Commands, state,
  store, utils, the host clip route, tests, and the `party_censor` table via
  a generated migration.
  *Done when:* no `censor` reference remains under `server/` outside old
  migration files, the new migration drops the table on boot, and
  `bun run test` plus `bun run build` pass.

## Verify

1. `bun run build`, then `bun run party`.
2. Open the host panel in a fresh tab, log in, load a game: the cover shows on
   the first song and on later ones (try a show whose cover was saved locally).
3. No Preview or censor section on the host panel; `C` and `D` do nothing.
4. The display plays, reveals, and applies blur/pixelate/blackout and cover
   mode as before.
5. `bun run test` is green.
