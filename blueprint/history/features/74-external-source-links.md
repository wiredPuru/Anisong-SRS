# Feature: External source links

**From build-plan:** feature 74
**Status:** verified

## Goal

Let a card's show and theme be opened on AniList and AnimeThemes.moe with
one click, from Study, every card Preview, and `/cards`' inspector. The
AnimeThemes link goes to the exact theme page when we know it, using
AnimeThemes' own slugs saved on import, and falls back to the show page
otherwise. Links never give away an answer that is still hidden.

## In scope

- Migration: nullable `anime.animethemes_slug` and
  `song.animethemes_video_slug`.
- Import saves both from AnimeThemes' data: anime import (full theme query)
  and the per-anime match lookup that song/artist import and the existing
  match backfill use.
- `upsertAnime` / `upsertSong` never erase a stored slug with null (the same
  null-drop rule they already apply to `animethemesId` /
  `animethemesThemeId`).
- A Settings backfill action that fills the slugs for existing cards, one
  batched AnimeThemes lookup covering many anime, with progress, in the same
  shape as the AnimeThemes match backfill.
- `CardWithDetails` gains `animeAnimethemesSlug` and
  `animethemesVideoSlug`.
- A pure client helper that builds the link list, and a small
  `CardSourceLinks` component used by `StudyInfoPanel` (so `/study` and
  `CardPreviewModal`) and the `/cards` inspector.

## Out of scope

- **AnisongDB links.** anisongdb.com is an Angular single-page app with no
  router and no code that reads its URL (checked 2026-09-23), so there is
  nothing to link to.
- **MyAnimeList links.** We do not store a MAL id; not requested.
- **Deck export/import manifests.** They do not carry slugs; the backfill
  fills imported decks' anime afterwards.
- **Links in immersive/overlay mode** (Preview's expanded view). The overlay
  is chips over the video; the non-expanded panel carries the links.
- **Links on `/decks` rows or deck headers.** They are reachable through
  Preview, which every deck detail row already opens.
- **Re-probing anime AnimeThemes has no entry for.** An anime with a null
  `animethemesId` is the existing match backfill's job; this backfill only
  asks about anime AnimeThemes is already known to have.

## Verification decision (2026-09-24)

The user asked that implementation continue to completion using best judgment.
AnimeThemes continued returning HTTP `522`, so provider-dependent completion
checks used the running app with controlled provider responses and a copied
database. AnimeThemes' published GraphQL schema and web slug builder were
checked independently. This verifies parsing, persistence, links, backfill,
and outage handling without claiming a successful request to the live service.
A real-provider smoke check remains follow-up work when AnimeThemes recovers.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Schema + pure helpers (no visible change)** - Drizzle
  migration `0020_animethemes_link_slugs` adding nullable
  `anime.animethemes_slug` and `song.animethemes_video_slug` (text). Server
  `animethemesVideoSlug({ type, sequence, groupSlug, entryVersion,
  videoTags })` in `server/utils/animethemesLinks.ts`, mirroring
  AnimeThemes' own `createVideoSlug`. Client `buildSourceLinks(input)` in
  `app/utils/sourceLinks.ts` returning the ordered link list (see Data /
  contracts).
  *Done when:* the migration applies on `bun run dev` boot against a DB copy
  with both columns present and null; `bun run test` is green with the tests
  under Testing; `bun run build` passes; the confirmed URL format is noted
  in this spec.
  **Confirmed URL format (2026-09-23, from source, site was down):**
  animethemes-web routes `src/pages/anime/[animeSlug]/[videoSlug]`, and its
  `src/utils/createVideoSlug.ts` builds the video slug as
  `type + (sequence || 1)`, then `v<version>` when the entry version is not
  1, then `-<group.slug>` when the theme has a group, then `-<tags>` when
  the video has tags. The GraphQL API exposes all five (`AnimeTheme.type`,
  `sequence`, `group { slug }`, `AnimeThemeEntry.version`, `Video.tags`), so
  steps 2-3 query those rather than `AnimeTheme.slug`. A live check of one
  page is still owed once AnimeThemes is back up.

- [x] **Step 2 - Capture slugs on anime import** - add anime `slug`, each
  theme's `type`, `sequence` and `group { slug }`, its first entry `version`,
  and first video `tags` to
  `FIND_BY_ANILIST_QUERY` (`server/lib/animethemes.ts`), carry them through
  `AnimeThemeLookup` and the theme merge in `themeSource.ts`, and store them
  from `/api/lookup/import` via `upsertAnime` / `upsertSong`. Both upserts
  drop a null slug from their update set, like `animethemesId` /
  `animethemesThemeId` today. An AnisongDB-only theme stores no video slug.
  *Done when:* against a DB copy, importing a new anime via the Anime group
  on `/cards` stores its anime slug and a video slug on each
  AnimeThemes-matched song (`sqlite3` query); re-importing it with
  AnimeThemes unavailable leaves both slugs unchanged; parser and upsert
  tests pass; `bun run build` passes.
  **Status 2026-09-23:** code, tests (992 pass) and build done; re-import
  with AnimeThemes down kept seeded slugs (Onegai Teacher, AniList 195) and
  stored none on its AnisongDB-only ED1. The fresh-import check was completed
  against controlled AnimeThemes responses on 2026-09-24, as recorded below.
  **Verified 2026-09-24:** fresh Anime-group import against a copied
  database stored the fixture anime slug and a video slug assembled from
  AnimeThemes' type/sequence/group/version/tags, including an OP2 slug while
  the app's slot was OP1. AnisongDB-only themes kept no video slug.
  Re-import during a simulated outage preserved all stored values. The real
  GraphQL endpoint returned HTTP `522`; recovery validation is recorded below.

- [x] **Step 3 - Capture slugs on song/artist import and match backfill** -
  add the same fields to `TITLES_BY_ANILIST_QUERY` and
  `AnimeThemeTitles`, carry them through the match index
  (`startMatchIndexLoads` / `findThemeMatch`), and store them wherever a
  match's `animethemesThemeId` is stored today: song import, artist import,
  and the existing AnimeThemes match backfill (`storeMatchResult`).
  *Done when:* against a DB copy with controlled provider responses while
  AnimeThemes is unavailable, adding a song through the Song group and one
  through the Artist modal each stores the anime slug and the song's
  video slug when AnimeThemes has the theme, and neither when it does not;
  titles-parser and match-backfill tests cover the new fields; `bun run
  build` passes.
  **As built:** the match index keeps `findThemeMatch` returning a theme id
  and adds `animethemesSlug` + `videoSlugByThemeId`; `matchLinkSlugs(index,
  themeId)` reads both. `setAnimeAnimethemesSlug` (`lookup.ts`) stores the
  anime slug after the fact, since these routes upsert the anime before the
  lookup. Revision completed 2026-09-24: fill missing slugs even when a song
  already has a card or theme id, and
  include AnimeThemes-sourced artist groups in the batched lookup. Resolve
  a video slug by the known theme id before falling back to title matching.
  Existing cards remain exempt from the match gate, and an outage must not
  erase stored slugs or reject a known match.
  **Status 2026-09-23:** code, tests (996 pass) and build done; song import
  with AnimeThemes down succeeded without slugs (Beastars OP1, already
  matched, so no lookup). Import regression coverage and controlled provider
  verification were completed 2026-09-24, as recorded below.

  **Revision 2026-09-24:** song import now resolves missing slugs for known
  matches and existing cards, skipping the lookup only when the match and
  both slugs are already stored. It refreshes the returned existing card
  after enrichment. Artist import includes all anime groups in the batched
  lookup and uses incoming or stored theme ids ahead of title matching.
  Regression coverage includes mismatched titles, missing slugs on known
  ids, existing-card gate exemptions, and provider outages. Updated the
  import-progress test's provider mock for the newly exercised lookup.
  **Verified 2026-09-24:** Song and AnisongDB Artist imports through the
  browser, plus an AnimeThemes-sourced Artist API import, stored the anime
  slug and video slug for known theme IDs. An unmatched song remained
  unlinked. Stored IDs won over mismatched titles; existing cards received
  enrichment without becoming blocked. The live endpoint returned HTTP
  `522`; controlled imports used the published slug contract.

- [x] **Step 4 - Settings backfill** - `server/utils/animethemesLinkBackfill.ts`
  lists card-backed anime with a non-null `animethemesId` whose slug is null,
  or which have a song with a non-null `animethemesThemeId` and a null video
  slug. It resolves them through the batched titles lookup (fetcher injected
  like `backfillAnimeThemesMatches`), writes the anime slug and each song's
  video slug by `animethemesThemeId`, and reports progress through
  `respondWithImportProgress`. An outage leaves rows untouched so the next
  run retries them. `POST /api/lookup/animethemes-links`, a count on the
  existing `GET /api/media-library` payload the way the match backfill's
  count is exposed, and a `SettingsAnimeThemesLinksControl.vue` next to the
  match control ("Fill AnimeThemes links", with the count, disabled at 0,
  and a result line).
  *Done when:* `bun run test` covers filled, partly filled, not-found and
  outage cases; on a DB copy with controlled provider responses, the control
  shows a non-zero count, a run fills
  rows (`sqlite3` before/after counts), the count drops to 0 or to only the
  anime AnimeThemes did not return, and a second run changes nothing; when
  the provider returns an outage, the run reports unavailable and writes
  nothing;
  `bun run build` passes.
  **As built:** the control sits in Settings > Media library beside Cover
  art (the other metadata backfill), not beside the match control in
  Playback. Candidates are per anime; the batched titles lookup via
  `startMatchIndexLoads` is reused.
  **Verified 2026-09-24:** with 63 candidates in a database copy, simulated
  outage returned `unavailable: 63`, left the candidate count unchanged, and
  preserved stored slugs across backfill and re-import. With provider
  responses restored, Settings filled 63/63 candidates; the count reached
  zero, and a second run checked zero anime.

- [x] **Step 5 - Links in the info panel (Study + Preview)** - server
  `cardSelection` and `CardWithDetails` gain `animeAnimethemesSlug` and
  `animethemesVideoSlug` (after `animeAniListId`); the client copies that
  feed the panel (`useStudySession.ts`, `CardPreviewModal.vue`) gain the same
  fields in the same place. New `components/card/CardSourceLinks.vue` takes
  the link list and renders `AniList` and `AnimeThemes` as
  `target="_blank" rel="noopener noreferrer"` links, with a tooltip saying
  whether the AnimeThemes link opens the theme or the show page.
  `StudyInfoPanel` gains an optional `sourceLinks` prop, rendered as a
  "Links" detail row after Theme, and omitted when absent, empty, or
  `immersive`. `/study` and `CardPreviewModal` pass
  `buildSourceLinks(card)`.
  *Done when:* in a browser, a card with both slugs shows both links on
  `/study` and in Preview, and they open `anilist.co/anime/<id>` and the
  theme page in new tabs; a card without a video slug links the show page;
  a card with no AnimeThemes data shows AniList only; with Hide Info on, or
  Typed Answers on before submission, the row is blurred and nothing in it
  can be clicked, focused with Tab, or hovered to reveal a URL (the panel's
  existing `inert`); after reveal the links work; the expanded Preview
  overlay shows no links row; no console errors; `bun run build` passes.
  **Verified 2026-09-23** with slugs seeded into a DB copy (Natsu no
  Arashi! ED3): both links, show-page fallback, AniList-only, new tab on
  click; hidden under Hide Info and Typed Answers (blurred, `inert`, not
  Tab-focusable, clicks hit the reveal overlay); Preview from `/decks` shows
  the row and expanded Preview does not. The Links row sits after Notes. The
  one console error, a `/study` hydration mismatch, also occurs on `master`.
  `CardPreviewModal` declares the slug fields optional, since `/decks` and
  `/stats` pass their own card copies.

- [x] **Step 6 - Links in the /cards inspector** - `/cards`' client
  `CardWithDetails` gains the two fields, and the inspector renders
  `CardSourceLinks` as a "Links" block between Notes and Sources, absent when
  the list would be empty.
  *Done when:* selecting cards with full, partial and no AnimeThemes data in
  `/cards` shows the matching links (screenshots), links open in new tabs,
  the inspector's layout at its default and narrow widths has no overflow
  (`bun run measure /cards` with the inspector open); `bun run build`
  passes.
  **Verified 2026-09-23** (DB copy, seeded): both links (Natsu no Arashi!
  ED3), show-page fallback (Onegai Teacher), AniList only (Onegai Twins);
  `bun run measure` at 1400 and 1000 wide keeps `.source-links` (344px)
  inside the 400px inspector; at 800 the page stacks as in feature 50h.

## Files / areas

| File | Why |
|---|---|
| `nuxt-app/server/db/schema.ts`, `migrations/0020_*.sql` | Two nullable slug columns. |
| `nuxt-app/server/utils/animethemesLinks.ts` + `.test.ts` | New. `animethemesVideoSlug`. |
| `nuxt-app/server/lib/animethemes.ts` + tests | Queries and parsers carry the anime slug, entry version and video tags. |
| `nuxt-app/server/utils/themeSource.ts`, `server/utils/lookup.ts` + tests | Carry slugs through the match index; upserts store them with the null-drop rule. |
| `nuxt-app/server/api/lookup/import.post.ts`, `song-import.post.ts`, `artist-import.post.ts` | Pass slugs to the upserts where theme ids are passed today. |
| `nuxt-app/server/utils/animethemesLinkBackfill.ts` + `.test.ts` | New. Backfill candidates and run. |
| `nuxt-app/server/api/lookup/animethemes-links.post.ts`, `server/api/media-library.get.ts` | New route; pending count. |
| `nuxt-app/app/components/settings/SettingsAnimeThemesLinksControl.vue`, settings page | New Settings control. |
| `nuxt-app/server/utils/cards.ts` | `cardSelection` / `CardWithDetails` gain the two fields. |
| `nuxt-app/app/utils/sourceLinks.ts` + `.test.ts` | New. `buildSourceLinks`. |
| `nuxt-app/app/components/card/CardSourceLinks.vue` | New. Renders the list. |
| `nuxt-app/app/components/study/StudyInfoPanel.vue` | Optional `sourceLinks` row. |
| `nuxt-app/app/pages/study/index.vue`, `app/components/card/CardPreviewModal.vue`, `app/composables/useStudySession.ts` | Pass links; client type copies. |
| `nuxt-app/app/pages/cards/index.vue` | Inspector Links block; client type copy. |

## Data / contracts

**Schema (load-bearing):**

- `anime.animethemesSlug` - text, nullable. AnimeThemes' anime slug
  (`bocchi_the_rock`).
- `song.animethemesVideoSlug` - text, nullable. AnimeThemes' page slug for
  the theme's first video (`OP1-NCBD1080`, `ED1`, `OP2v2-NC`). **Never
  derived from `song.themeSlot`**: feature 60a found the providers number
  slots differently, so a slot-built path can open a different song.
- Neither is ever cleared by an import; only a later non-null value replaces
  one.

**`CardWithDetails`** gains, after `animeAniListId`:

```ts
animeAnimethemesSlug: string | null;
animethemesVideoSlug: string | null;
```

Client copies (F-09) are updated only where the fields are read (steps 5
and 6); other copies stay as they are, which TypeScript's structural typing
allows.

**Client helper:**

```ts
// app/utils/sourceLinks.ts
export interface SourceLink {
  site: "anilist" | "animethemes";
  label: string;   // "AniList" | "AnimeThemes"
  href: string;
  title: string;   // tooltip: "Open on AniList", "Open this theme on AnimeThemes", "Open the show on AnimeThemes"
}
export function buildSourceLinks(card: {
  animeAniListId: number;
  animeAnimethemesSlug: string | null;
  animethemesVideoSlug: string | null;
}): SourceLink[];
```

- AniList: `https://anilist.co/anime/<animeAniListId>`, always present.
- AnimeThemes: `https://animethemes.moe/anime/<slug>/<videoSlug>` when both
  are set, `https://animethemes.moe/anime/<slug>` with only the anime slug,
  absent with no anime slug. A video slug without an anime slug produces no
  AnimeThemes link. Path segments are `encodeURIComponent`-encoded.

**Route:** `POST /api/lookup/animethemes-links` - no body, streamed
progress like `POST /api/lookup/animethemes-match`, final result
`{ checked, filled, notFound, unavailable }`.

## Testing

Vitest is configured (`bun run test`), so the logic gate is on.

| Step | Test |
|---|---|
| 1 | `animethemesVideoSlug`: plain, ED + sequence, version 2, tags, version + tags, group, all parts, missing sequence -> 1, version 1 or null (no `v1`), empty tags/group, blank type -> null. `buildSourceLinks`: both slugs, anime slug only, video slug only, neither, an id and slugs that need encoding. |
| 2, 3 | Parser cases for both queries' new fields (present, missing, malformed -> null, never throws). `upsertAnime` / `upsertSong` keep a stored slug when the new value is null and replace it when non-null. |
| 4 | Backfill with an injected fetcher: full fill, anime found but a theme id missing (song stays null), anime not returned (`notFound`), outage (`unavailable`, no writes); candidate query excludes anime with a null `animethemesId` and cards already filled. |
| 5, 6 | UI: browser evidence via the `playwright-cli` skill plus `bun run build`. |

**Final evidence (2026-09-24):** `bun run test` passed 1,008 tests across
65 files; `bun run build` and `git diff --check` passed. Browser flows against
the built app and a copied database verified Anime, Song, and both Artist
imports; 63/63 link backfill and an empty second run; unchanged slugs during
outage; AniList, theme-page, show-page fallback, and AniList-only links;
new-tab security attributes; Hide Info/Typed Answers focus blocking; Preview
and expanded omission; and layouts at 1400, 1000, and 800px without horizontal
overflow. The browser reported zero errors. A direct real-service request
still returns HTTP `522`; repeat one provider smoke check when it recovers.
Browser fixtures and screenshots were temporary files under
`/private/tmp/gaq-feature74.*`.

**Run browser and backfill checks against a database copy**: `sqlite3
.data/gaq-srs.db ".backup <scratch>/gaq-srs.db"` then
`GAQ_SRS_DATA_DIR=<scratch> bun run dev --port <n>`.

## Notes for the AI

- **AnimeThemes returned HTTP `522` on 2026-09-24.** Provider-dependent
  checks used controlled responses against the published API and slug
  contracts, as recorded under Verification decision. Repeat one live
  provider smoke check when the service recovers.
- The video slug formula is copied from AnimeThemes' web source (see step
  1). Keep it in one pure function so a correction is one change.
- The existing queries take `animethemeentries(first: 1)` and
  `videos(first: 1)`, and the clip URL already comes from that same node, so
  the linked page is the same video the card plays.
- `TITLES_BY_ANILIST_QUERY` is deliberately light (one request covers dozens
  of anime). Add only the anime `slug`, theme `type`/`sequence`/`group`,
  entry `version`, and video `tags` to it, not links or artists.
- Links sit inside `StudyInfoPanel`, which `/study` already renders blurred
  and `inert` until reveal. Do not add a second hiding mechanism; verify the
  existing one covers the new row, including hover and Tab.
- The `/study` page is already long. Build the list with one computed from
  `buildSourceLinks(currentCard)`, not per-link template logic.
- Colors from `main.css` tokens only; links reuse the existing `deck-link`
  look or a token-based equivalent.
- No em dashes in code comments, commit messages, or spec updates.
