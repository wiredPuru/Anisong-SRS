# AnimeThemes match backfill for existing cards

**Type:** Fix
**Status:** verified

## The problem

The `themesOnly` setting (fix `themes-only-mode`, 2026-09-21) filters Study on
`Song.animethemesThemeId IS NOT NULL`, and feature 70a's library filter reads
the same column. Both treat a null as "AnimeThemes.moe does not have this
song". It does not mean that. The match lookup only arrived with feature 70b,
so every card imported before it has a null id that nobody ever checked.

Measured on the live library (2026-09-21): 151 cards, 103 with a null id
across 65 distinct anime. Probing five of them through the existing
`loadAnimeThemesMatchIndex` + `findThemeMatch`, "LOVE A RIDDLE" (AniList 195)
resolves to AnimeThemes theme `1633` while its card stores null. So turning the
setting on hides cards that do have AnimeThemes entries, and on a deck whose
cards are all unchecked it empties the queue entirely.

Null currently conflates two different states: **unknown** (never probed) and
**absent** (probed, AnimeThemes does not have it). Only the second one should
be filtered out.

## The fix

An explicit Settings action that probes the unchecked songs and records what it
finds, mirroring the two existing backfill actions (`cover-backfill.post.ts` +
`SettingsCoverArtControl.vue`, and `source-refresh.post.ts` +
`SettingsCardSourceControl.vue`), including their progress streaming and their
"count shown comes from the same query that does the work" rule.

Separating unknown from absent needs one new column: `Song.animethemesCheckedAt`
(nullable datetime). The probe sets it whether or not a match was found, so a
genuinely absent song is never re-probed and the Settings count can reach zero.

- Reuses `loadAnimeThemesMatchIndex` and `findThemeMatch` unchanged, one lookup
  per anime (65 today), not per song.
- Runs only when asked. Toggling `themesOnly` on never triggers 65 network
  lookups by itself.
- **Must not break:** an AnimeThemes outage leaves rows untouched rather than
  marking them absent (`index.status === "unavailable"` is the same fail-open
  signal `isMissingAnimeThemesMatch` already honours); no card is deleted,
  rescheduled, or has its clip URLs rewritten; the Clip source setting is not
  consulted, since this is metadata, not playback hosts.

## Build steps

- [x] 1. **Candidates, matching, and storage.** Migration + schema for
  `animethemes_checked_at`; `server/utils/animethemesMatch.ts` with a candidate
  query (cards whose song has a null id and a null checked-at), anime-grouped
  shaping, and the store step that writes a found theme id and always stamps
  checked-at. Unit tests for the pure shaping and for the unavailable case
  leaving a row unstamped.
  **Done when:** tests cover a match, a genuine miss, and an outage, and
  `bun run test` is green.
- [x] 2. **Route + count.** `POST /api/lookup/animethemes-match-backfill`
  streaming progress via `respondWithImportProgress`, and a
  `animethemesUncheckedCount` on `GET /api/media-library` from the same query
  the run uses.
  **Done when:** calling the route against the live library stamps the
  unchecked songs and stores theme `1633` for AniList 195's "LOVE A RIDDLE",
  and the count drops to the number of genuine misses.
- [x] 3. **Settings control.** A control in the Playback section directly above
  the themes-only toggle, showing the unchecked count, a run button with
  progress, and a result summary. The themes-only toggle's hint points at it
  while a count remains.
  **Done when:** the control runs from `/settings` and reports what it found.

## Verify

1. `bun run test` and `bun run build` in `nuxt-app/` pass.
2. `/settings` shows the unchecked count, and running it reports matched and
   missing totals.
3. After the run, `/study` with themes-only on serves more than the 34 cards it
   serves today, and every card it serves has an AnimeThemes match.
4. With themes-only off, Study still serves all 137 due cards.
