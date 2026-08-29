# GAQ SRS - Project Overview

<!-- blueprint:source-hash 10a12cafd9f5fc0dedcbdc8b990b7c57d5338402fbf23487da7e0216b05ea470 -->

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

Build-plan order. Features 1-17 and 19-23 (the full MVP, manual decks, the
study-screen ambient glow, the home page/nav bar, Preview editing, delete
cleanup, pagination/search, Preview expand + ambient mode, the volume
slider, deck-detail Preview, and Study's own expand toggle) are built and
merged. Feature 18 was built then rolled back (see its entry below) and is
pending a redesign; 24 is next.

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
15. **Home page + navigation bar** - done. `/` - a launcher hub (links to
    Study, Cards, Decks, Stats, Settings - no live data) plus a persistent
    top nav bar, via a shared Nuxt layout, present on every page.
16. **Edit card metadata from Preview** - done. `CardPreviewModal` gained an
    edit mode: song title, theme slot (validated against `Song`'s
    `(animeId, themeSlot)` uniqueness), local video/audio paths, and artist -
    either rename the `Artist` row in place (affects every card built from
    any song by that artist, since `Song.artistId` is shared) or reassign
    the song to a different/new artist (get-or-create, only affects that
    song). `PATCH /api/cards` carries the new fields; `/cards`' existing
    local-path-only row edit is untouched, a second entry point to the same
    underlying capability.
17. **Delete card cleans up orphaned files** - done. `DELETE /api/cards`
    (`deleteCard`) now removes a deleted card's local video/audio files from
    disk, unless another remaining card's local path is the exact same file.
    Best-effort: a missing file or a filesystem error is swallowed, same
    degrade-gracefully behavior as everywhere else. Remote sources
    (`animethemesVideoUrl`/`animethemesAudioUrl`) are never touched.
18. **Per-scope quiz-mode preference** - built, then rolled back
    2026-08-29 (pending a redesign). A settings table keyed by study scope
    (artist id / anime id / "all" - manual decks excluded since `/study`
    can't be scoped to one yet), each independently settable to Auto /
    Audio-only / Video-only. Rolled back because its `forcedMode`
    mechanism let `StudyMediaPlayer`'s `mediaKind` change after playback
    had already started, causing two audio streams to play at once; a
    targeted fix didn't resolve it. See
    `blueprint/history/rollbacks/2026-08-29-18-per-scope-quiz-mode-preference.md`.
    A future rebuild is not bound to the old shape - the mid-playback swap
    is exactly what needs to change.
19. **Library scale-up: pagination + search** - done, two sub-features:
    - **19a. Pagination** - done. Numbered pages, ~25/page
      (`PAGE_SIZE` in `server/utils/pagination.ts`), on the top-level
      `/cards` list, top-level `/decks` list, and the card list inside a
      deck's detail view, via a shared `<Pager>` component and a
      `Paginated<T>` return shape.
    - **19b. Global search** - done. An autocomplete dropdown in the
      persistent nav bar (`/api/search`), searching across
      cards/decks/anime/artists, jumping straight to a result on
      selection - a card result hands off to `/cards` via a shared
      `pendingCardPreview` `useState`, pre-opening that card's Preview
      modal on arrival.
20. **Preview expand + ambient mode** - done. `CardPreviewModal` gained an
    expand button that grows the modal to fill the viewport (in-page
    overlay via an `expanded` class, not the native Fullscreen API) and,
    independently, a minimal ambient-mode toggle (✨) reusing
    `StudyMediaPlayer`'s existing `ambient` prop. The ambient choice
    persists across Preview opens (`localStorage` key
    `gaqSrs:previewAmbient`) - the app's first persisted UI preference;
    everywhere else (Study's toggles) resets every session.
21. **Video volume slider** - done. A volume control in `StudyMediaPlayer`,
    covering both `/study` and `CardPreviewModal` since both share that
    component. The chosen level persists across sessions (localStorage),
    unlike Study's other session-only display toggles.
22. **Preview on deck detail card rows** - done. A per-row Preview button on
    a deck's detail card list (Artist/Anime/Created), reusing the existing
    `CardPreviewModal` from `/cards` unchanged.
23. **Expand toggle on /study's player** - done. A viewport-filling expand
    control for `/study`'s own video/audio player, separate from Preview's
    own expand (feature 20) since `/study`'s layout (video + side info
    panel + pass/fail controls) needs its own expand design.
24. **Glass surface, automatic with ambient mode** - not started.
    `/study`'s player and `CardPreviewModal`'s panel turn translucent and
    frosted (`backdrop-filter` blur, via plain `--glass-surface` /
    `--glass-border` / `--glass-blur` tokens) automatically whenever that
    surface's own ambient-mode toggle is on - an `ambient-glass` class
    bound directly to each component's existing `ambient`/`ambientMode`
    state, no separate theme setting, no persistence, no `/settings` UI.
    Redirected from an initial standalone Theme picker design (built,
    verified working, then found to read as pointless since most of the
    app barely visibly reacted to a separate toggle) before that version
    was ever merged.

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

> Feature 16 added two ways to change an artist after creation: rename the
> row in place (global, affects every song by that artist) or reassign a
> single song to a different/new artist via the same get-or-create helper
> the lookup flow uses. Reassigning away from an artist can leave it with
> zero songs - nothing prunes that row automatically.

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
> the default download folder) without changing this shape. Feature 17
> means deleting a card also deletes its local file(s) from disk, unless
> another remaining card's local path points at the exact same file.

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

### Study scope playback preference (rolled back, feature 18)

Built as a `studyScopeSetting` table (one row per study scope, plus a
`forcedMode` prop threaded into `StudyMediaPlayer`), then rolled back
2026-08-29 - the table was dropped from the live database and its
migration removed, so it is **not** part of the current schema. The
rollback reason (changing `mediaKind` after playback had already started,
causing overlapping audio) means a future redesign should not simply
rebuild the old shape - the mid-playback swap is exactly what needs to
change. Full detail lives in
`blueprint/history/rollbacks/2026-08-29-18-per-scope-quiz-mode-preference.md`
and the original archive at
`blueprint/history/features/18-per-scope-quiz-mode-preference.md`.

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
  files downloaded by feature 8, and removes files feature 17 cleans up

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

- `/` - done (feature 15). A launcher hub with links to Study, Cards, Decks,
  Stats, Settings - no live data, no dashboard stats. Ships alongside a
  persistent top nav bar in a shared Nuxt layout, present on every page.
- `/settings` - done. Media library folder configuration, plus (feature 8) a
  default download folder picker shown once 2+ folders are configured, plus
  (feature 9) an "Import deck" form (source path -> created/skipped summary
  or per-entry errors) - this is where feature 9 resolved its own
  then-undecided placement question.
- `/cards` - done. Flashcard list/management, plus (feature 8) a per-source
  download action shown when a card has a remote reference and no local
  file yet. Feature 11 added a per-row "Preview" button opening a modal
  (playback + info, reused from `/study`'s components) - feature 16 later
  gave that modal an edit mode (song title, theme slot, artist, local
  paths). Feature 12 added an anime cover thumbnail per row (absent, not
  broken, when that anime has none). Feature 13b added a per-row "Decks"
  panel (checkbox per manual deck, toggling calls the assignment API
  immediately - no save step). Feature 17 made the existing Delete button
  also remove the card's now-unreferenced local file(s), with no added
  confirmation step.
- `/cards/new` - done. Add a card via AniList/animethemes.moe lookup, with
  the same download action available right after a card is added.
- `/decks` - done. Artist and Anime-Title deck groupings, list + detail, plus
  (feature 9) a per-deck export control and (feature 12) anime cover
  thumbnails on anime-type decks. Feature 13a added a third "Created" toggle
  for manual decks - create/rename/delete inline, real card counts and card
  list once 13b landed, with a per-card "Remove" action found only in the
  manual-deck detail view. Neither "Study this deck" nor the export block
  appears there. Feature 22 added a per-row "Preview" button to the detail
  card list (all three deck types), reusing `CardPreviewModal` unchanged
  and refetching via the page's existing `fetchDeckDetail()` when an
  in-modal edit is saved.
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
  stays unaffected. Feature 21 added a persisted volume slider
  (`localStorage` key `gaqSrs:playerVolume`) inside `StudyMediaPlayer`
  itself, so `/study` and `CardPreviewModal` share the same volume level.
  Feature 23 added a separate, `/study`-only expand toggle (`allowExpand`
  prop, not passed from `CardPreviewModal`) that grows the player to fill
  the viewport - independent of Preview's own expand from feature 20.
- `/stats` - done. Overall pass rate plus a By Artist / By Title toggle,
  each row's guess rate.

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
