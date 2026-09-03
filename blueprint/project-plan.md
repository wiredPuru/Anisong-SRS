# Project Plan

## 1. Problem - What problem are we solving?

Memorizing anime openings/endings (song titles, artists, and the anime they
belong to) for competitive/casual play on animemusicquiz.com (AMQ). This is a
personal Anki/Migaku-style spaced-repetition flashcard app, purpose-built for
anime song trivia rather than general-purpose language SRS.

## 2. Users - Who is this for?

Just the project owner, and by extension anyone else who plays AMQ and wants to
run their own local copy. Not a multi-tenant product - each user runs their own
instance against their own local media and database.

## 3. Features - What does the MVP need?

- **Data layer** - SQLite schema (Drizzle ORM) for anime, songs/themes, cards,
  decks, and review history.
- **Media library settings** - point the app at one or more local/external
  folders that hold clip files (video/MP3); the app references files from
  there rather than storing them.
- **Anime & song lookup** - search and pull metadata from AniList (GraphQL) and
  animethemes.moe (GraphQL, see https://api-docs.animethemes.moe) when
  creating a card: titles in English, Romaji, and Japanese, artist, and
  available OP/ED themes.
- **Flashcard CRUD** - create, read, update, delete cards at any time. A card
  references a song/theme and either a local media file or a direct
  animethemes.moe reference (or both). Should be able to auto import whole artists for example Kotoko
  This will create cards for each of her songs that Animethemes.moe has and include an option to download the video. 

- **Card quiz type** - not chosen manually; derived from whichever media is
  attached. Video-backed cards can play video; audio-only cards play MP3 only.
- **Decks** - automatic categorization by Artist (all songs in the DB by that
  artist) or by Anime Title (all songs in the DB for that anime), plus
  user-created manual decks: named, flat (no nesting), and a card can belong
  to any number of manual decks at once. A library view browses/groups decks
  by Created (manual), Artist, or Anime.
- **Study session** - Leitner-box spaced repetition, scoped to one deck at a
  time with an "all decks" option to pull from every due card across decks.
  Two outcomes per card: pass/fail, presented as left arrow (fail) / right
  arrow (pass), matching the Anki/Migaku convention. Fail returns a card to a
  shorter review interval; pass advances it to a longer one.
- **Language display** - English, Romaji, and Japanese are each independently
  toggleable and can all be shown at once if desired; Furigana is a separate
  sub-toggle under Japanese (only relevant when Japanese is on). Furigana is
  auto-generated (not sourced from the API) via a Japanese morphological
  analyzer. Applies to both anime titles and song titles - song titles gain a
  native-Japanese variant sourced from lookup, alongside the anime title's
  existing English/Romaji/Native fields.
- **Playback** - "play song" plays audio only and requires a guess; "show
  video" plays from the start of the clip if a video exists.
- **Review stats** - guess-rate tracking, sliceable by artist and by anime
  title.
- **Deck export/import** - exports card metadata always. MP3/audio files can be
  bundled in the export; video files are never bundled (size). On import, any
  card missing local media can be re-linked by pulling from animethemes.moe
  when a remote reference exists.

## 4. Data - What are we storing?

- Anime and song/theme metadata (titles in EN/Romaji/JP, artist, OP/ED info),
  cached locally from AniList/animethemes.moe lookups.
- Flashcards: link to a song/theme, local file path and/or animethemes.moe
  reference, current Leitner box/interval state.
- Decks: derived groupings by Artist and by Anime Title, plus manually-created
  decks stored as their own entity with a many-to-many link to cards (a card
  can belong to zero or more manual decks).
- Song metadata gains a native-Japanese title field, alongside its existing
  title.
- Review history / stats: per-card pass/fail log, used to compute guess rate by
  artist and by anime title.
- User-configured media library folder path(s).

## 5. Tech - What stack are we using?

- Nuxt (TypeScript), `nuxt-app/` as the sole application package.
- SQLite via Drizzle ORM + better-sqlite3.
- GraphQL client against AniList's public API for anime/song metadata.
- GraphQL client against animethemes.moe (https://api-docs.animethemes.moe)
  for theme (OP/ED) video/audio and metadata.
- Japanese morphological analyzer (e.g. kuroshiro/kuromoji) for furigana
  generation.
- Local filesystem access (Node `fs`) for the user-configured media library.

## 6. Monetize - How will this make money?

Non-profit. No monetization planned.

## 7. UI/UX - How should this look and feel?

- Akihabara arcade signage, not cute/moe - the same otaku-culture reference
  point, read through neon storefronts and game-centre panels rather than
  soft cartoon shapes. Dark blue-black ground, sakura pink as the primary
  accent, cyan as the secondary. Superseded an earlier "cute/moe, a little
  cartoony" direction (build 50).
- Tight corners, not rounded throughout - small radii on panels and controls,
  with full pills reserved for buttons and badges. Also a reversal of the
  earlier direction, made deliberately in build 50.
- App layout: a persistent left rail for navigation, with content in split
  panes that use the full window width, rather than a centered single column.
- Study layout: video centered, song/title info panel on the right. Unchanged
  by build 50 - the redesign keeps this arrangement and only collapses the
  display-toggle row into a single icon strip.
- Language toggles (EN/Romaji/Japanese, with Furigana as a Japanese
  sub-toggle) and the screen's other display toggles (Hide Video, Hide
  Info, Hide Cover, Random Start, Ambient mode) render as always-visible
  inline buttons on the study screen, with an `H` hotkey and a subtle icon
  to hide/show them together when not needed. Auto Reveal sits alongside
  them as a single button opening a small popup, since it carries a mode
  choice (Video / Info / Both) and a countdown interval rather than being
  a plain on/off. Core playback/interaction
  controls (play/pause, pass/fail, scrub, volume, expand) stay inline. An
  `E` hotkey toggles an immersive expanded mode that overlays all card
  info directly on the video instead of showing it in a side panel, and
  stays active as you move between cards.
- Review controls follow Anki/Migaku convention: pass/fail buttons, or left
  arrow (fail) / right arrow (pass) as keyboard shortcuts.
- Japanese text must render as real, selectable DOM text (not baked into an
  image or video) so the Migaku browser extension can attach its dictionary
  popup to it.
- Study video gets an ambient glow (YouTube Ambient Mode-style): a blurred,
  color-sampled halo behind the player while a real video frame is visible,
  off for audio-only cards or when Hide Video is active.
- The study player (and its Preview-modal equivalent) turns translucent
  and frosted automatically whenever ambient mode is on - no separate
  theme setting, since the glass look only makes sense paired with the
  ambient glow it's meant to show through.

## 8. Deployment - Where and how will this ship?

Localhost-only. A website reachable in any browser of choice as long as the
app is running on the user's own system. No remote hosting, no accounts, no
multi-device sync. Two ways to run it: the developer workflow (`bun run
dev`/`bun run preview`) for development, and a packaged standalone
executable (build 48) for end users - a self-contained per-OS/arch binary
that starts the local server and opens the browser, with no separate
Node/Bun/Nuxt install required.

## 9. Non-Goals

Nothing was explicitly ruled out, but the following are assumed out of scope
given the "local, for myself" framing, and should be confirmed/revisited if
priorities change:

- Cloud sync or multi-device support
- Accounts/auth for multiple users sharing one instance
- A mobile app
- Any AMQ game mode beyond flashcard review (e.g., live multiplayer quiz)

## Notes

`nuxt-module/` was scaffolded during initial Blueprint setup as a possible
reusable module but was removed once the plan confirmed this is a single local
app; `nuxt-app/` is the only package going forward.
