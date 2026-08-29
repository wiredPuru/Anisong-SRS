# GAQ SRS - Project Overview

<!-- blueprint:source-hash 45e19ff9e5afd278b8de8b809c49a5af762d20fd6fd97df54dca8ba8405d35f6 -->

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

Build-plan order. Features 1-14 (the full MVP plus manual decks and the
study-screen ambient glow) are built and merged; 15 is next.

1. **Data layer** - done. SQLite schema (Drizzle ORM) for anime,
   songs/themes, cards, and review history.
2. **Media library settings** - done. `/settings` - configure local/external
   folders the app reads clip files from.
3. **Anime & song lookup** - done. `/api/lookup/*` - search AniList and
   animethemes.moe (both GraphQL) and cache metadata (EN/Romaji/JP titles,
   artist, OP/ED themes) into the local DB.
4. **Flashcard CRUD** - done. `/cards`, `/cards/new` - create/edit/delete
   cards from looked-up song data; attach a local file and/or an
   animethemes.moe reference.
5. **Decks by Artist/Title** - done. `/decks` - automatic, query-time
   grouping of cards by artist or by anime title (no separate deck table).
6. **Study session** - the headline feature, split into three sub-features:
   - **6a. Leitner queue + review API** - done. `/api/study/next`,
     `/api/study/review` - the scheduling engine (no UI).
   - **6b. Study session UI** - done. `/study` - the actual session screen:
     video/audio playback, pass/fail controls, looping through the due-card
     queue.
   - **6c. Language display toggles** - done. Independently toggleable
     English/Romaji/Japanese+Furigana display on the study screen; added a
     Japanese morphological analyzer dependency.
7. **Review stats** - done. `/stats` - guess-rate tracking (overall and
   sliced by artist / by anime title), read from `ReviewLog`.
8. **Downloadable options for Cards** - done. A default download folder
   setting (`/settings`) plus a download action on `/cards` and `/cards/new`
   that pulls a card's `animethemesVideoUrl`/`animethemesAudioUrl` into the
   local media library and sets the matching local path.
9. **Deck export/import** - done. `POST /api/decks/export`/`/api/decks/import`
   bundle one deck (artist or anime) to a plain directory - `manifest.json`
   always, an `audio/` folder of copied local files only when requested,
   never video. Import is self-contained (no live API calls), idempotent per
   song (re-importing skips existing cards), and falls back to the
   manifest's stored remote URLs when no local file was bundled.
10. **Study session display toggles** - done. Session-only toggles on
    `/study`: Hide Video (`v`), Hide Info (`i`, blurs the info panel rather
    than removing it), and Start at random times (except the last 15
    seconds, re-rolled on every presentation of a card - including a repeat
    after a fail, not just a fresh card id). Reset every time a session
    starts; not persisted. Play/pause also picked up an `s` hotkey here.
11. **Card preview** - done. `/cards` has a "Preview" button per row (hidden
    for a card with no source) opening a modal that reuses
    `StudyMediaPlayer`/`StudyInfoPanel` as-is - playback, scrub, and the
    language toggles, no pass/fail or study-state writes. Closes via ✕,
    backdrop click, or `Escape`. Not on `/cards/new` (deferred). Its
    component lives at `components/card/CardPreviewModal.vue` (singular
    `card/`, not `cards/` - Nuxt's auto-import prefix-stripping needs the
    filename to start with the folder name, so plural `cards/` would have
    registered it as `<CardsCardPreviewModal>`).
12. **Anime cover art** - done. Fetches each anime's AniList cover image on
    lookup and stores it as a hotlinked CDN URL (not downloaded); shown as a
    thumbnail on `/cards` and on anime-type `/decks` (list, detail header,
    detail card rows) - never on artist-type decks, since an artist can span
    multiple anime with no single cover to show.
13. **Manual decks + library view** - done, in two sub-features:
    - **13a. Deck CRUD** - done. `deck` table; `POST`/`PATCH`/`DELETE
      /api/decks` create/rename/delete a manual deck (name trimmed,
      duplicate-checked); a third "Created" toggle on `/decks` lists them
      with inline rename/delete. A manual deck's detail view suppresses
      "Study this deck" and the export block - `StudyScope` and export both
      still only cover artist/anime, deliberately not extended here.
    - **13b. Card assignment** - done. `deck_card` join table (own `id` PK
      plus a `(deckId, cardId)` unique, cascading both ways); `POST`/`DELETE
      /api/decks/cards` add/remove a card from a deck (idempotent both
      ways), `GET /api/decks/memberships` returns every card's membership
      in one query. `/cards` has a per-row "Decks" checkbox panel; `/decks`
      shows real card counts and a real card list per manual deck with a
      "Remove" action. Not on `/cards/new` (same deferral feature 11 made
      for its own Preview button on that page).
14. **Ambient video glow on Study** - done. A soft, blurred, color-sampled
    glow behind the video player on `/study`, active only while a real video
    frame is showing (not audio-only, not Hide Video); covers the whole
    background and is toggleable.
15. **Home page + navigation bar** - not started. A `/` launcher hub (links
    to Study, Cards, Decks, Stats, Settings - no live data) plus a
    persistent top nav bar, via a shared Nuxt layout, present on every page.

## Data model

### Anime

- `id` (integer, PK)
- `aniListId` (integer, unique) - external AniList reference
- `animethemesId` (integer, nullable) - external animethemes.moe reference
- `titleEnglish` (string) - falls back to `titleRomaji` if AniList has no
  English title
- `titleRomaji` (string)
- `titleNative` (string, Japanese) - falls back to `titleRomaji` if AniList
  has no native title

### Artist

- `id` (integer, PK)
- `name` (string, unique) - uniqueness added in feature 3 so lookups can
  get-or-create without duplicating an artist across imports

### Song

A specific OP/ED theme track.

- `id` (integer, PK)
- `animeId` (FK -> Anime)
- `artistId` (FK -> Artist)
- `title` (string) - as sourced from animethemes.moe/AniList
- `themeSlot` (string) - e.g. `"OP1"`, `"ED2"`
- `animethemesThemeId` (integer, nullable) - external reference, used to
  re-fetch or re-link media later
- Unique on `(animeId, themeSlot)`

### Card

The flashcard itself. Quiz type (video vs audio-only) is **derived**, not
stored: video if any video source is present, audio-only otherwise.

- `id` (integer, PK)
- `songId` (FK -> Song)
- `localVideoPath` (string, nullable) - within the configured media library
- `localAudioPath` (string, nullable)
- `animethemesVideoUrl` (string, nullable)
- `animethemesAudioUrl` (string, nullable)
- `box` (integer, default `1`) - current Leitner box
- `nextReviewAt` (datetime, default now) - when the card is next due
- `createdAt` (datetime)

> A card must have at least one non-null source across the four
> local/remote fields (enforced by feature 4's create/update validation). A
> card can hold a local reference, a remote reference, or both. Feature 8
> adds a way to turn a remote-only source into a local one (download into
> the default download folder) without changing this shape.

**`CardWithDetails`** (load-bearing shared shape, returned by `/api/cards`,
`/api/decks/cards`, `/api/study/next`, `/api/study/review`,
`/api/cards/download`):

```ts
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  songTitle: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
}
```

### ReviewLog

Backs the guess-rate stats feature (7) and is written by every
`POST /api/study/review` call (feature 6a).

- `id` (integer, PK)
- `cardId` (FK -> Card, cascades on delete)
- `reviewedAt` (datetime, default now)
- `result` (`"pass"` | `"fail"`)
- `boxBefore` (integer)
- `boxAfter` (integer)

### MediaLibrarySettings

Singleton row (`id` always `1`).

- `id` (integer, PK)
- `libraryPaths` (JSON array of strings) - local/external folders the app
  reads clip files from
- `defaultDownloadFolder` (string, nullable) - added in feature 8; must be
  one of `libraryPaths`. Where a downloaded card source is saved. Cleared
  automatically if its folder is removed from `libraryPaths`.

> **Artist/Anime decks stay derived** - query-time groupings of `Card` joined
> through `Song` by `artistId` or `animeId`, not a stored entity. Manual
> decks (feature 13) are the one deck type that *is* stored, via the
> `Deck`/`DeckCard` shapes below.

### Deck

Feature 13a. A user-created, flat (no parent/child) named deck.

- `id` (integer, PK)
- `name` (string, unique) - trimmed and duplicate-checked before insert, not
  relying on the DB constraint as the primary validation path
- `createdAt` (datetime)

### DeckCard

Feature 13b. Many-to-many join between `Deck` and `Card` - a card can belong
to zero or more manual decks, independent of its Artist/Anime grouping.

- `id` (integer, PK)
- `deckId` (FK -> Deck, cascades on delete)
- `cardId` (FK -> Card, cascades on delete)
- Unique on `(deckId, cardId)`

**Deck / study scope shapes** (load-bearing, shared across features 5, 6a,
and 6b):

```ts
type DeckRef = { type: "artist"; id: number } | { type: "anime"; id: number };
type StudyScope = { type: "all" } | DeckRef;
```

### Leitner scheduling (locked in feature 6a)

5 boxes. Pass advances one box (capped at 5); fail resets to box 1.
`nextReviewAt = now + interval[newBox]`:

| Box | Interval before next due |
|---|---|
| 1 | 0 days (immediately due again) |
| 2 | 1 day |
| 3 | 3 days |
| 4 | 7 days |
| 5 (max) | 14 days |

Box 1's 0-day interval is what lets a failed card resurface later in the
same study session purely by calling `/api/study/next` again - there is no
stored session queue.

## Tech stack

- **Nuxt (TypeScript)** - application framework; `nuxt-app/` is the only
  package
- **SQLite + Drizzle ORM + better-sqlite3** - local data persistence,
  migrations applied automatically on server boot
- **AniList GraphQL API** - anime metadata lookup (`graphql.anilist.co`)
- **animethemes.moe GraphQL + media CDN** (`graphql.animethemes.moe`,
  `v.animethemes.moe`, `a.animethemes.moe`) - OP/ED theme video/audio and
  metadata, and the files feature 8 downloads. Requires a non-default
  `User-Agent` header (blocks Node's bare default with a `403`) - see
  feature 3's archive.
- **Japanese morphological analyzer** (e.g. kuroshiro/kuromoji) - added in
  feature 6c for furigana generation
- **Node `fs`** - reads the user-configured local media library and writes
  files downloaded by feature 8

## Monetization

Non-profit. No monetization planned.

## UI/UX

Cute/moe, a little cartoony - Akihabara, anime posters, otaku culture as the
visual reference. Rounded corners throughout. Japanese text renders as real,
selectable DOM text (never baked into an image or video) so the Migaku
browser extension can attach to it. Theme tokens (colors, fonts, radii) live
in `nuxt-app/app/assets/css/main.css`, ported from `prototypes/theme.css`.

Established conventions across every page/route built so far: `useFetch` for
the initial load (with explicit loading/error states, never just the happy
path), `$fetch` for mutations, scoped `<style>` blocks using `var(--token)`.
No dynamic route segments (`[id].ts`) exist anywhere yet - every route uses
query-string parameters (`?type=&id=`) or a body-carried `id` for mutations,
and that convention should continue rather than mixing in a new one.

Routes:

- `/settings` - done. Media library folder configuration, plus (feature 8) a
  default download folder picker shown once 2+ folders are configured, plus
  (feature 9) an "Import deck" form (source path -> created/skipped summary
  or per-entry errors) - this is where feature 9 resolved its own
  then-undecided placement question.
- `/cards` - done. Flashcard list/management, plus (feature 8) a per-source
  download action shown when a card has a remote reference and no local
  file yet. Feature 11 added a per-row "Preview" button opening a modal
  (playback + info, reused from `/study`'s components). Feature 12 added an
  anime cover thumbnail per row (absent, not broken, when that anime has
  none). Feature 13b added a per-row "Decks" panel (checkbox per manual
  deck, toggling calls the assignment API immediately - no save step).
- `/cards/new` - done. Add a card via AniList/animethemes.moe lookup, with
  the same download action available right after a card is added.
- `/decks` - done. Artist and Anime-Title deck groupings, list + detail, plus
  (feature 9) a per-deck export control and (feature 12) anime cover
  thumbnails on anime-type decks. Feature 13a added a third "Created" toggle
  for manual decks - create/rename/delete inline, real card counts and card
  list once 13b landed, with a per-card "Remove" action found only in the
  manual-deck detail view. Neither "Study this deck" nor the export block
  appears there.
- `/study` - done. Video centered, title/artist info panel on the right,
  pass/fail (or left/right arrow) controls, EN/Romaji/JP+Furigana display
  toggles. `prototypes/study.html` was its original design reference
  (consumed; `prototypes/` no longer exists). Feature 10 added three more
  session-only toggles here (Hide Video `v`, Hide Info `i`, Start at random
  times), plus an `s` hotkey for play/pause - each hotkeyed button shows a
  hover tooltip naming its key (established convention: any hotkeyed button
  gets one, via a custom `<span class="tooltip">` rather than the native
  `title` attribute, which only triggers over a button's text glyphs in some
  browsers). Feature 14 added an ambient glow behind the player, sampled
  from the video via canvas rather than a second `<video>` element, to
  avoid double-loading remote animethemes.moe clips - `/study` only,
  gated on a real video frame showing (not audio-only, not Hide Video),
  covers the whole background, and is user-toggleable.
  `CardPreviewModal` (which reuses the same `StudyMediaPlayer` component)
  stays unaffected.
- `/stats` - done. Overall pass rate plus a By Artist / By Title toggle,
  each row's guess rate.
- `/` - not started (feature 15). A launcher hub with links to Study,
  Cards, Decks, Stats, Settings - no live data, no dashboard stats.
  Ships alongside a persistent top nav bar in a shared Nuxt layout,
  present on every page.

## Deployment

Localhost-only - no remote hosting, no accounts, no multi-device sync.

- **App type**: Nuxt server (Nitro), run on the user's own machine
- **Build**: `bun run build` (see Commands in `AGENTS.md`)
- **Run**: `bun run preview` (production) or `bun run dev` (development)
- **Storage**: SQLite database at `nuxt-app/.data/gaq-srs.db` (resolved in
  feature 1; gitignored, created and migrated automatically on first boot)
  plus the user-configured media library folder(s)
- **Env vars**: none identified yet
- **Health check / domain**: not applicable (local-only)

## Open questions

`project-plan.md`'s Flashcard CRUD section still has an uncommitted note
about auto-importing an artist's **entire catalog** in one action. Feature 8
deliberately covered only the narrower half of that note (a per-card
download option) and explicitly left bulk artist import out of scope. The
bulk-import idea remains unresolved and unbuilt - fold it into a future
build-plan item (its own feature, not an amendment to 8) before building
anything against it.

## Notes

`nuxt-module/` was scaffolded during initial setup as a possible reusable
module, then removed once the plan confirmed this is a single local app.
`nuxt-app/` is the only package.
