# GAQ SRS - Project Overview

<!-- blueprint:source-hash 2f81cfc132d1331ad06ffa4dac7473b575996affb302deb306f9c68d4aaac95e -->

> A personal, local-only Anki/Migaku-style spaced-repetition flashcard app for
> memorizing anime opening/ending songs, titles, and artists (AMQ trivia
> practice).

## Problem

Playing animemusicquiz.com (AMQ) well requires recognizing anime songs,
titles, and artists quickly. There's no purpose-built spaced-repetition tool
for this - general SRS apps like Anki aren't tailored to anime song trivia
(video/audio playback of the actual clip, multi-language title display,
artist/anime-based deck organization). This app fills that gap as a personal,
local training tool.

## Users

- **The project owner** - primary and only intended user for now.
- **Other AMQ players** - by extension, anyone who wants to run their own
  local copy against their own media library. Not a multi-tenant product: no
  accounts, no shared instances, no cloud sync (see Non-goals).

## Features

Build-plan order; each is a full MVP slice, not yet split into implementation
steps (that's `/feature`'s job).

1. **Data layer** - SQLite schema (Drizzle ORM) for anime, songs/themes,
   cards, and review history. Foundation every other feature depends on.
2. **Media library settings** - configure one or more local/external folders
   the app reads clip files from.
3. **Anime & song lookup** - search AniList and animethemes.moe (both
   GraphQL) and pull metadata - EN/Romaji/JP titles, artist, available OP/ED
   themes - for a chosen anime.
4. **Flashcard CRUD** - create, edit, delete cards built from looked-up song
   data; attach a local file and/or an animethemes.moe reference.
5. **Decks by Artist/Title** - automatic, query-time grouping of cards by
   artist or by anime title (no separate deck table - see Data model).
6. **Study session** - the headline feature. Leitner-box scheduled review
   queue (deck-scoped, or "all decks"), video/audio playback, pass/fail
   (left/right arrow) controls, and independently toggleable
   English/Romaji/Japanese+Furigana display.
7. **Review stats** - guess-rate tracking, sliceable by artist and by anime
   title.
8. **Deck export/import** - bundles card metadata always, audio optionally
   (never video); import can re-link missing local media from animethemes.moe
   when a remote reference exists.

## Data model

### Anime

- `id` (integer, PK)
- `aniListId` (integer) - external AniList reference
- `animethemesId` (integer, nullable) - external animethemes.moe reference
- `titleEnglish` (string)
- `titleRomaji` (string)
- `titleNative` (string) - Japanese

### Artist

- `id` (integer, PK)
- `name` (string)

> Multi-language display (§Language display) applies to anime titles, as
> that's the only field the plan names EN/Romaji/JP variants for. Artist and
> song titles are stored as sourced (typically romaji) unless a later feature
> asks for translated variants too.

### Song

A specific OP/ED theme track.

- `id` (integer, PK)
- `animeId` (FK -> Anime)
- `artistId` (FK -> Artist)
- `title` (string) - as sourced from animethemes.moe/AniList
- `themeSlot` (string) - e.g. `"OP1"`, `"ED2"`
- `animethemesThemeId` (integer, nullable) - external reference, used to
  re-fetch or re-link media later

### Card

The flashcard itself. Quiz type (video vs audio-only) is **derived**, not
stored: video if any video source is present, audio-only otherwise.

- `id` (integer, PK)
- `songId` (FK -> Song)
- `localVideoPath` (string, nullable) - within the configured media library
- `localAudioPath` (string, nullable)
- `animethemesVideoUrl` (string, nullable)
- `animethemesAudioUrl` (string, nullable)
- `box` (integer) - current Leitner box
- `nextReviewAt` (datetime) - when the card is next due
- `createdAt` (datetime)

> A card can hold a local reference, a remote reference, or both, per the
> plan ("or both"). Export bundles `localAudioPath` content directly but
> never `localVideoPath`/video content; a card missing local media on import
> falls back to its `animethemesVideoUrl`/`animethemesAudioUrl` when present.

### ReviewLog

Backs the guess-rate stats feature.

- `id` (integer, PK)
- `cardId` (FK -> Card)
- `reviewedAt` (datetime)
- `result` (enum: `pass`, `fail`)
- `boxBefore` (integer)
- `boxAfter` (integer)

### MediaLibrarySettings

Singleton row.

- `id` (integer, PK)
- `libraryPaths` (JSON array of strings) - local/external folders the app
  reads clip files from

> **No Deck table.** The plan is explicit that decks are "derived groupings...
> not separately stored as manually-curated entities unless that changes
> later." Deck screens query `Card` joined through `Song` by `artistId` or by
> `animeId`, they don't read from a stored deck entity. Locking this now
> because Features 5 and 6 both depend on it.

## Tech stack

- **Nuxt (TypeScript)** - application framework; `nuxt-app/` is the only
  package (see Notes on `nuxt-module/` removal)
- **SQLite + Drizzle ORM + better-sqlite3** - local data persistence
- **AniList GraphQL API** - anime metadata lookup
- **animethemes.moe GraphQL API** (https://api-docs.animethemes.moe) - OP/ED
  theme video/audio and metadata
- **Japanese morphological analyzer** (e.g. kuroshiro/kuromoji) - furigana
  generation for the Japanese-text toggle
- **Node `fs`** - reads the user-configured local media library

## Monetization

Non-profit. No monetization planned.

## UI/UX

Cute/moe, a little cartoony - Akihabara, anime posters, otaku culture as the
visual reference. Rounded corners throughout. Japanese text renders as real,
selectable DOM text (never baked into an image or video) so the Migaku
browser extension can attach to it.

Routes below are a reasonable structure derived from the feature list; the
plan doesn't name them explicitly, so treat these as a starting point for
`/feature`, not a fixed contract:

- `/study` - the study session: video centered, title/artist info panel on
  the right, language toggles, pass/fail (or left/right arrow) controls
- `/decks` - Artist and Anime-Title deck groupings
- `/cards` - flashcard list/management
- `/cards/new` - add a card via AniList/animethemes.moe lookup
- `/stats` - guess-rate stats by artist and by anime title
- `/settings` - media library folder configuration, deck export/import

## Deployment

Localhost-only - no remote hosting, no accounts, no multi-device sync.

- **App type**: Nuxt server (Nitro), run on the user's own machine
- **Build**: `bun run build` (see Commands in `AGENTS.md`)
- **Run**: `bun run preview` (production) or `bun run dev` (development)
- **Storage**: SQLite database file on disk (exact path/location not yet
  decided - `> TODO`, settle when the Data layer feature is spec'd) plus the
  user-configured media library folder(s)
- **Env vars**: none identified yet
- **Health check / domain**: not applicable (local-only)

## Notes

`nuxt-module/` was scaffolded during initial setup as a possible reusable
module, then removed once the plan confirmed this is a single local app.
`nuxt-app/` is the only package.
