# Themes-compatible mode setting

**Type:** Fix
**Status:** verified

## The problem

Feature 70b hard-gates every import: an AnisongDB-only song (no AnimeThemes.moe
counterpart, `Song.animethemesThemeId` null) shows disabled with "Not on
AnimeThemes.moe, so it cannot be added." That is the wrong default. The user
wants to add, install, and download from AnisongDB freely, and to opt into an
AnimeThemes-compatible library only as a mode.

What is wanted is one persistent Settings toggle, **default off**:

- **Off (default):** nothing is restricted. Any AnisongDB song can be added and
  downloaded, exactly as before 70b. Study queues every card.
- **On:** training (Study) only serves cards whose song has an AnimeThemes.moe
  match, and the import gate from 70b applies again so new unmatched cards are
  not added.

Clip source is untouched: AnisongDB stays the preferred clip host in both modes
(feature 64 governs hosts; this only governs which songs are eligible).

## The fix

Mirror the existing `autoDownload` setting end to end (migration, get/set in
`server/utils/mediaLibrary.ts`, `POST /api/media-library/...` route, field on
`GET /api/media-library`, control in `/settings`'
Playback section). Name: `themesOnly` (boolean, not null, default `false`).

1. **Import gate becomes conditional.** `import.post.ts`, `song-import.post.ts`,
   and `artist-import.post.ts` (the routes 70b changed) read the setting; when
   off they report `noAnimethemesMatch: false` and skip the extra match-index
   lookup 70b added. When on, behavior is exactly 70b's. Client components need
   no change: they already render off the response flag.
2. **Study filter.** When on, `dueCardCondition` (`server/utils/cards.ts`)
   additionally requires `song.animethemesThemeId IS NOT NULL`, so the next
   card, the "cards left" counter, and the prefetch lookahead all agree. A
   card with no match is skipped, never deleted or altered.
3. **Must not break:** `/cards` library, Preview, and deck views still show
   every card in both modes (70a's filter and bulk delete are unchanged); Leitner
   scheduling and stored data are untouched; the Clip source guard is unchanged.

## Build steps

- [x] 1. **Setting plumbing.** Drizzle migration + schema column, `getThemesOnly`/
  `setThemesOnly`, `POST /api/media-library/themes-only`, field on
  `GET /api/media-library`, and a toggle in `/settings` Playback with a short
  explanation. Test the parse/validation like `auto-download`'s.
  **Done when:** the toggle appears in Settings, defaults off, and its value
  survives a reload.
- [x] 2. **Conditional import gate.** Wire the setting into the three import
  routes. Tests: off returns `noAnimethemesMatch: false` without calling the
  match lookup; on keeps 70b's existing results.
  **Done when:** with the toggle off, an AnisongDB-only song adds normally on
  `/cards`; with it on, it shows disabled with the 70b note.
- [x] 3. **Study filter.** Add the condition to `dueCardCondition` when on.
  Test the condition/count both ways with a matched and an unmatched card.
  **Done when:** with the toggle on, `/study` never presents an unmatched card
  and "cards left" excludes it; with it off, it is served again.

## Verify

1. `bun run test` and `bun run build` in `nuxt-app/` pass.
2. Settings: toggle on, reload, still on; toggle off, reload, still off.
3. Off: search a song only AnisongDB has, add it, download it.
4. On: the same result is disabled with the note; `/study` skips any existing
   unmatched card while `/cards` still lists it.
