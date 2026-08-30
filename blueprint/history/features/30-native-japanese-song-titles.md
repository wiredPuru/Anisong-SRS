# Feature: Native Japanese song titles + split Furigana toggle

**From build-plan:** feature 30
**Status:** verified

## Goal

Give `Song` its own native-Japanese title (like `Anime` already has), and
split the single "JP + Furigana" toggle on Study/Preview into an independent
Japanese toggle plus a Furigana sub-toggle, applying to both the anime title
and the song title.

## In scope

- A new nullable `titleNative` column on `Song`, populated from
  animethemes.moe's `song.title.native` field (already fetched by the
  existing GraphQL query, currently discarded) whenever a card is created
  through the lookup/import flow.
- A `songTitleNative` field on the shared `CardWithDetails` server shape
  (the one load-bearing type behind `/api/cards`, `/api/decks/cards`,
  `/api/study/next`, `/api/study/review`, `/api/cards/download`), resolved
  server-side as `Song.titleNative` falling back to `Song.title` when no
  native title is stored - so it's never null on the wire, matching how
  `Anime.titleNative` is already always-populated.
- Splitting `StudyInfoPanel`'s single "JP + Furigana" toggle into two:
  "Japanese" (shows native text) and "Furigana" (sub-toggle, only
  meaningful when Japanese is on; adds ruby-annotation furigana over the
  native text via the existing `/api/furigana` route, or shows plain
  unannotated native text when off).
- Applying that same Japanese/Furigana toggle pair to the song title too -
  today the Song block always shows one plain title with no language
  variants at all; it gains a toggle-gated native-title line alongside the
  anime title's existing toggle-gated lines.
- Threading the new prop through both places that render
  `StudyInfoPanel`: `/study` (via `useStudySession.ts`'s `CardWithDetails`)
  and `CardPreviewModal.vue`.

## Out of scope

- Editing a song's native title from anywhere (`CardPreviewModal`'s edit
  mode, `/cards`' row edit) - it's populated only from the lookup/import
  pipeline, matching how `Anime.titleNative` isn't user-editable anywhere
  either.
- Deck export/import manifest changes (feature 9). An exported/imported
  deck's cards will simply fall back to `Song.title` for their native-title
  display (no crash, no data loss beyond not carrying the richer field) -
  extending that self-contained bundle format is a separate, later
  decision, not bundled into this feature.
- Backfilling `titleNative` for songs that already exist in the database
  from before this feature - the column starts `NULL` for them and the
  `COALESCE` fallback covers display; nothing re-fetches animethemes.moe
  for already-imported songs.
- Any change to the Furigana generation logic itself (`server/utils/
  furigana.ts`, the `kuroshiro` pipeline) - reused as-is via the existing
  generic `/api/furigana?text=` route.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `Song.titleNative` column + migration** - add a nullable
  `titleNative` (`title_native`) text column to the `song` table in
  `server/db/schema.ts`, run `bun run db:generate` (per Commands in
  `AGENTS.md`) to produce the migration, and confirm it applies cleanly.
  *Done when:* the generated migration file adds only that one nullable
  column (no prompts needed, since it's nullable - no default required),
  and `bun run dev` boots cleanly against the existing dev database with
  the new column present (verified via a direct query against the dev
  SQLite file).
- [x] **Step 2 - Populate it from the lookup/import pipeline** - in
  `server/lib/animethemes.ts`, add `songTitleNative: string | null` to
  `AnimeThemeLookup` and capture `theme.song?.title.native ?? null` in
  `toThemeLookup` (the existing `songTitle` fallback chain is untouched -
  this is purely an additional field, not a behavior change to what's
  already there). In `server/utils/lookup.ts`, add an optional
  `titleNative: string | null` param to `upsertSong` and write it on
  insert/update. Wire `server/api/lookup/import.post.ts` to pass
  `theme.songTitleNative` through. *Done when:* importing a real anime via
  `POST /api/lookup/import` against a scratch dev server, then querying
  the `song` table directly, shows `title_native` populated with the
  Japanese title animethemes.moe returned for at least one theme.
- [x] **Step 3 - Expose `songTitleNative` on `CardWithDetails`** - in
  `server/utils/cards.ts`, import `sql` from `drizzle-orm` and add
  `songTitleNative: sql<string>\`coalesce(${song.titleNative},
  ${song.title})\`` to `cardSelection` (and the matching field to the
  `CardWithDetails` interface). Since every card-returning route already
  goes through this one shared `cardQuery()`/`cardSelection`, no other
  server file needs to change. *Done when:* `GET /api/cards` (or any other
  card-returning route) includes `songTitleNative` in each row - equal to
  the stored native title for a song imported in Step 2's test, and equal
  to `songTitle` (the fallback) for a pre-existing song with no native
  title stored - verified via curl against a scratch dev server.
- [x] **Step 4 - Split the toggle and show it on Study/Preview** - in
  `app/components/study/StudyInfoPanel.vue`: replace the single `showJp`
  ref with `showJapanese` and `showFurigana` (both default `true`,
  preserving today's default look); the Furigana button is disabled when
  Japanese is off; rework the furigana-loading logic into one function that
  resolves both the anime title and the (new) song title together - via
  `/api/furigana` when Furigana is on, or the plain native text directly
  when it's off (skipping the fetch entirely in that case) - replacing the
  old single-text, always-furigana-annotated behavior. Add a
  `songTitleNative` prop and a toggle-gated native-title line to the
  `.song-block` (styled consistently with the existing `.jp` anime-title
  line). Thread the new prop through both callers: `useStudySession.ts`'s
  `CardWithDetails` interface (feeds `/study`) and `CardPreviewModal.vue`'s
  local interface + its `StudyInfoPanel` binding. *Done when:* on `/study`
  and in a card's Preview, toggling Japanese on/off shows/hides both the
  anime and song native-title lines together; toggling Furigana on/off
  (only while Japanese is on) switches both lines between plain native
  text and furigana-annotated HTML; the Furigana button is visibly
  disabled while Japanese is off; default state on load matches today's
  look (both on, furigana shown).

## Files / areas

- `nuxt-app/server/db/schema.ts` - `song.titleNative` column (Step 1).
- `nuxt-app/server/db/migrations/` - generated migration (Step 1).
- `nuxt-app/server/lib/animethemes.ts` - capture the native title (Step 2).
- `nuxt-app/server/utils/lookup.ts` - `upsertSong` stores it (Step 2).
- `nuxt-app/server/api/lookup/import.post.ts` - wiring (Step 2).
- `nuxt-app/server/utils/cards.ts` - `songTitleNative` on `CardWithDetails`
  (Step 3).
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - toggle split, dual
  furigana resolution, song-title native line (Step 4).
- `nuxt-app/app/composables/useStudySession.ts` - prop threading (Step 4).
- `nuxt-app/app/components/card/CardPreviewModal.vue` - prop threading
  (Step 4).

## Data / contracts

- `Song.titleNative: string | null` - new column, nullable, no backfill for
  existing rows (see Out of scope).
- `CardWithDetails.songTitleNative: string` - new field on the load-bearing
  shared shape, always resolved (never null on the wire), matching
  `animeTitleNative`'s existing convention.
- `AnimeThemeLookup.songTitleNative: string | null` - new field on the
  animethemes.moe lookup shape, load-bearing for Step 2 only (internal to
  the import pipeline, not exposed over an API response).

## Testing

No test runner is configured in `AGENTS.md` yet. The one piece of real
logic here - the `COALESCE` fallback in Step 3 - is a single SQL
expression with no branching worth a unit test even once a runner exists
(same class as the `deriveCounts` helper in `stats.ts`, which coding-
standards' Testing section doesn't flag as a candidate either). Everything
else is data plumbing and UI toggle state. Verify via `bun run build` at
every step, direct SQLite queries for Steps 1-2, curl for Step 3, and a
manual/browser pass over Step 4's toggle behavior on both `/study` and a
card's Preview.

## Notes for the AI

- Follow the exact `sql<T>` computed-column pattern already established in
  `server/utils/stats.ts` (`passCountExpr`) for Step 3's `COALESCE` -
  don't introduce a different style.
- `Anime.titleNative`'s NOT NULL + write-time-fallback pattern is
  deliberately not repeated for `Song.titleNative` - see Out of scope for
  why (no safe backfill path for existing rows without a migration this
  project has no precedent for). The read-time `COALESCE` in `cardSelection`
  achieves the same "never null on the wire" guarantee without it.
- `toThemeLookup` in `animethemes.ts` already fetches `song.title { romaji
  native }` from animethemes.moe - Step 2 is purely capturing a field
  that's already being fetched and thrown away, not adding a new query.
- Reuse `/api/furigana?text=` exactly as-is (it's already fully generic,
  not anime-title-specific) - no server change needed for Step 4.
- Match existing patterns for the new toggle button (`.lang-btn` class,
  `on`/disabled states) and the new song-title-native line (reuse the
  existing `.jp` styling rather than inventing new tokens).
- For a song with no stored native title, the toggle-gated line will show
  the same text as the always-visible `songTitle` line (the `COALESCE`
  fallback). Don't special-case or suppress that - it's the same
  redundant-but-harmless behavior `Anime.titleNative` already has today
  when AniList has no native title (it silently equals `titleRomaji`, and
  the UI shows both anyway). Keep the two fields consistent rather than
  inventing new suppression logic only for songs.
