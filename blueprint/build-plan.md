# Build Plan

> One of the two planning docs you provide. Write it directly, develop it through
> any AI conversation, or optionally run `/discovery`. Keep the items high-level
> even when `project-plan.md` is detailed; later `/feature` specs hold the depth
> for each build item.

The features that make up this project, high level and in rough build order, one
line each, no detail (that comes per feature). Rough is fine at first, but before
`/overview` runs this file should be shaped into a checkbox list the build loop
can track.

Keep it as a checklist. Run `/feature` with no number to spec the **next
unchecked** item, or `/feature 3` / `/feature "login"` to pick a specific one.
Completed features get checked off here, so the build plan doubles as your
progress tracker. A big item gets split into sub-items (4a, 4b, etc.) when you
spec it.

## Continuing after the initial build

This is a living roadmap, not a plan that freezes when the first release is
done. Keep completed items checked, then append new unchecked features as the
project grows. Optional milestone headings such as `## MVP` and `## Post-MVP`
keep a longer plan readable without changing how `/feature` finds the next
unchecked item.

Do not renumber completed features because their archived specs refer back to
those numbers. Continue with the next unused number. If a new feature materially
changes the product direction, users, data, stack, monetization, UI/UX, or
deployment, update the relevant part of `project-plan.md` too. Then re-run
`/overview` before spec'ing the feature.

You can edit this file directly or ask the AI to start a new feature by name. If
`/feature "team workspaces"` does not match an existing item, it will propose the
new build-plan line and any necessary project-plan changes, wait for approval,
refresh the overview, and then write the feature spec.

Scaffolding the app (create-next-app, etc.) and prototyping the look are
pre-build steps, not features (see the README), so don't list them here. Start
with your first real slice of functionality.

A common order that works well: build the core UI with placeholder data first,
then wire up data, auth, and integrations. Add deployment readiness only when
the app is worth shipping or a provider config change is part of the work. Adapt
it to your project.

## Format

Use checkboxes. Each item should be a feature-sized outcome, not a loose task or
a whole product area.

These examples are fenced so they are never mistaken for real items in this
plan. The real checklist starts at `## MVP` below.

Good:

```markdown
- [ ] 1. **Skill submission** - upload a skill package and save its metadata
- [ ] 2. **Validation result** - run checks and show pass/fail status for a skill
- [ ] 3. **Directory listing** - browse and filter published skills
- [ ] 4. **Deployment readiness** - configure Render or Vercel and verify the
  production build
```

Avoid:

```markdown
- Upload stuff
- Database
- Make it look nice
- Auth, billing, dashboard, validation, and deploy
```

If your first pass is just rough bullets, that is okay. Run `/overview` after
filling both planning docs; it will flag plan-shape problems and can propose a
cleaned-up checkbox version before generating the project overview.

## MVP

- [x] 1. **Data layer** - SQLite schema (Drizzle ORM) for anime, songs/themes,
  cards, decks, and review history.
- [x] 2. **Media library settings** - configure one or more local/external
  folders the app references for clip files.
- [x] 3. **Anime & song lookup** - search AniList and animethemes.moe and pull
  metadata (EN/Romaji/JP titles, artist, available OP/ED themes) for a chosen
  anime.
- [x] 4. **Flashcard CRUD** - create, edit, and delete cards from looked-up
  song data; attach a local file and/or an animethemes.moe reference.
- [x] 5. **Decks by Artist/Title** - automatic grouping of cards into Artist
  and Anime-Title decks.
- [x] 6. **Study session** - Leitner-box scheduled review queue, video/audio
  playback, pass/fail (left/right arrow) controls, language toggle display
  with auto-generated furigana.
  - [x] 6a. **Leitner queue + review API** - scheduling logic (box/interval
    rules), next-due-card query (deck-scoped or all decks), and the
    endpoint that records a pass/fail and advances the card.
  - [x] 6b. **Study session UI** - the actual session screen: card display,
    video/audio playback (quiz type derived from attached sources),
    left/right arrow pass/fail controls, looping through the queue,
    deck-scoped or all-decks entry points.
  - [x] 6c. **Language display toggles** - independently toggleable
    English/Romaji/Japanese+Furigana display on the study screen; adds a
    Japanese morphological analyzer dependency for furigana generation.
- [x] 7. **Review stats** - guess-rate tracking, sliceable by artist and by
  anime title.
- [x] 8. **Downloadable options for Cards** - download from animethemes.moe as
  an option when editing or creating a card.
- [x] 9. **Deck export/import** - bundle metadata always and audio optionally
  (never video); re-link missing local media from animethemes.moe on import
  when available.
- [x] 10. **Study session display toggles** - session-only Hide Video, Hide
  Info, and Start at random times (except the last 15 seconds) toggles for
  the study screen.
- [x] 11. **Card preview** - a preview panel per card in card management
  showing playback (video/audio, scrub) and the same title/artist/anime
  info a study card shows, to verify a card works without starting a full
  study session.
- [x] 12. **Anime cover art** - fetch and store each anime's AniList cover
  image, and display it in card/deck browsing so anime are visually
  recognizable.

## Post-MVP

- [x] 13. **Manual decks + library view** - create/rename/delete named decks
  and assign cards to any number of them (many-to-many, flat - no nesting);
  browse decks in a library view groupable by Created (manual), Artist, or
  Anime.
  - [x] 13a. **Deck CRUD** - the `Deck` table; create/rename/delete; a third
    "Created" option on the existing `/decks` toggle (list + an empty
    detail view - no card assignment yet).
  - [x] 13b. **Card assignment** - the `DeckCard` join table and UI to add or
    remove a card from any number of manual decks, populating 13a's decks.
- [x] 14. **Ambient video glow on Study** - a soft, blurred, color-sampled
  glow behind the video player on /study (à la YouTube's Ambient Mode),
  active only while a real video frame is showing (not audio-only, not
  Hide Video).
- [x] 15. **Home page + navigation bar** - a `/` launcher hub (links to
  Study, Cards, Decks, Stats, Settings - no live data) plus a persistent top
  nav bar, via a shared Nuxt layout, present on every page.
- [x] 16. **Edit card metadata from Preview** - the Preview modal gains an
  edit mode for song title, theme slot (validated against the existing
  `(animeId, themeSlot)` uniqueness), local file paths, and artist - with a
  choice at edit time to either rename the artist globally (affects every
  card built from any song by that artist, since Artist is a shared table)
  or reassign the song to a different/new artist (get-or-create, only
  affects this song).
- [x] 17. **Delete card cleans up orphaned files** - deleting a card
  auto-deletes its local video/audio files, skipping any file path still
  referenced by another card.
- ~~18. **Per-scope quiz-mode preference**~~ - abandoned 2026-08-29. Built,
  then rolled back the same day (`forcedMode` let quiz mode change after
  playback started, causing overlapping audio - a targeted fix didn't
  resolve it), and now dropped from the roadmap entirely rather than
  redesigned. Not a build target; number retired, not reused. See
  `blueprint/history/rollbacks/2026-08-29-18-per-scope-quiz-mode-preference.md`.
- [x] 19. **Library scale-up: pagination + search**
  - [x] 19a. **Pagination** - numbered pages, ~25/page, applied to the
    top-level `/cards` list, top-level `/decks` list, and the card list
    inside a deck's detail view.
  - [x] 19b. **Global search** - an autocomplete dropdown in the persistent
    nav bar, searching across cards/decks/anime/artists, jumping straight to
    a result on selection.
- [x] 20. **Preview expand + ambient mode** - `CardPreviewModal` gains an
  expand button that grows the modal to fill the viewport (in-page overlay,
  not the native Fullscreen API) and, independently, a minimal ambient-mode
  toggle reusing `StudyMediaPlayer`'s existing `ambient` prop - not the full
  `StudyDisplayToggles` bar. The ambient choice defaults off but persists
  across Preview opens (localStorage), the first persisted UI preference in
  the app - everywhere else (Study's toggles) resets every session.
- [x] 21. **Video volume slider** - a volume control in `StudyMediaPlayer`,
  covering both `/study` and `CardPreviewModal` since both share that
  component. The chosen level persists across sessions (localStorage), unlike
  Study's other session-only display toggles.
- [x] 22. **Preview on deck detail card rows** - add a per-row Preview
  button to a deck's detail card list (Artist/Anime/Created), reusing the
  existing `CardPreviewModal` from `/cards` unchanged.
- [x] 23. **Expand toggle on /study's player** - a viewport-filling expand
  control for `/study`'s own video/audio player, separate from Preview's
  own expand (feature 20) since `/study`'s layout (video + side info panel
  + pass/fail controls) needs its own expand design.
- [x] 24. **Glass surface, automatic with ambient mode** - `/study`'s
  player and `CardPreviewModal`'s panel turn translucent and frosted
  (`backdrop-filter` blur) automatically whenever that surface's own
  ambient-mode toggle is on - no separate theme setting. Redirected from
  an initial standalone Theme picker design in `/settings`, which shipped
  working but read as pointless since most of the app barely visibly
  reacted to it.
- ~~25. **Standalone desktop packaging**~~ - abandoned 2026-08-30. Never
  started; dropped from the roadmap by user decision before any code was
  written, so there is nothing to roll back. Not a build target; number
  retired, not reused.
- [x] 26. **Global search: find + add shows** - the nav search bar also
  surfaces AniList results when local results don't cover the query, with
  an inline "Add" action that reuses the existing `/cards/new` lookup/import
  flow rather than duplicating it.
- [x] 27. **Explicit "Clear local file" action on cards** - a one-click
  button next to a card's local video/audio path (in both `/cards`' row
  edit and `CardPreviewModal`'s edit mode) that deletes the referenced file
  from disk (reusing feature 17's cleanup logic) and blanks the field,
  instead of relying on manually clearing the text input to the same effect.
- [x] 28. **Add existing cards to a deck from the deck page** - manual
  decks only (artist/anime decks are derived, not stored, so there is
  nothing to add to). A control on a manual deck's detail view to
  search/pick existing cards and attach them - the same action as `/cards`'
  "Decks" checkbox panel, initiated from the other direction.
- [x] 29. **Stats refresh + clear** - a manual refresh action on `/stats`,
  plus a destructive "clear" action that deletes `ReviewLog` history only
  (stats reset to zero; card box levels and due dates are untouched).
- [x] 30. **Native Japanese song titles + split Furigana toggle** - add a
  native-Japanese title field to `Song` (alongside the anime title fields
  that already exist), shown on Study/Preview. Split the current single
  "JP + Furigana" toggle into an independent Japanese toggle plus a
  Furigana sub-toggle, applying to both anime and song titles.
- [x] 31. **Immersive expanded study mode** - replaces the retired
  settings-panel idea. An `E` hotkey toggles an immersive expanded mode
  that overlays all card info (everything currently on the side info
  card - titles, artist, language toggles) directly on the video instead
  of beside it, with Pass/Fail also part of the overlay; unlike today's
  expand toggle, staying immersive carries across moving to the next card
  rather than resetting per card.
- ~~32. **Study playback-mode option**~~ - abandoned 2026-08-30. Never
  merged; dropped by user decision mid-build (spec'd and partially
  implemented, then discarded before any commit landed on master, so there
  is nothing to roll back). Not a build target; number retired, not
  reused. Original scope: in the immersive overlay from feature 31, a
  session-only choice (not persisted per scope, unlike the abandoned
  feature 18) between Audio-only / Video-only / Any (locals preferred).
- [x] 33. **Add new anime cards from a deck page** - a manual deck's detail
  view gains a way to look up and import a new anime/card via AniList (the
  same lookup/import flow as `/cards/new`), auto-attaching the created card
  to that deck - complementing feature 28's "add existing cards" search,
  not replacing it.
- [x] 34. **Deck assignment from card edit / Preview edit** - editing a
  card - either `/cards`' row edit or `CardPreviewModal`'s edit mode
  (feature 16) - gains the same "assign to any number of manual decks"
  checkbox panel `/cards` already has as its own separate "Decks" action
  (feature 13b), so deck membership can be managed right from the edit
  flow instead of only through that standalone panel.
- [x] 35. **Library search + infinite scroll** - per-page search/filter plus
  scroll-triggered loading, replacing feature 19a's numbered pagination, one
  list surface at a time.
  - [x] 35a. **Cards library search + infinite scroll** - a search box on
    `/cards` narrows the list by song/artist/anime title; its numbered
    `Pager` is replaced by "load more as you scroll."
  - [x] 35b. **Decks library search + infinite scroll** - the same two
    changes (search box + infinite scroll) applied to `/decks`' top-level
    list (Artist/Anime/Created).
  - [x] 35c. **Deck detail search + infinite scroll** - the same two
    changes applied to the card list inside a selected manual/artist/anime
    deck's detail view.
- [x] 36. **Unify Preview's expand mode with Study's immersive overlay** -
  `CardPreviewModal`'s own separate expand mechanism (feature 20 - grows
  the whole modal panel, video and info stacked, scrollable) is replaced
  by reusing `StudyMediaPlayer`'s existing immersive/overlay mechanism
  (feature 31 - info card over the video, `E` hotkey), so Preview and
  `/study` share one expand implementation instead of two
  independently-evolved ones. No Pass/Fail overlay in Preview (no
  quiz/review state there).
- [x] 37. **Bulk artist import** - a "search by artist" mode on `/cards/new`
  (alongside the existing anime search) that pulls in an artist's entire
  animethemes.moe catalog across every anime they have themes in, instead of
  one anime at a time.
  - [x] 37a. **Artist search + theme resolution** - find an artist on
    animethemes.moe by name, resolve every anime they have themes in via
    AniList (reusing the existing per-anime `upsertAnime`/`upsertSong`
    pipeline, looped across all of that artist's anime), and show a preview
    list of every song/theme found. No cards created yet.
  - [x] 37b. **Bulk card creation + download** - "Add all" (and per-row
    "Add") on that preview list creates a `Card` per selected theme, plus a
    bulk "download all" option reusing feature 8's existing download
    machinery.
- [x] 38. **Auto-reveal timer for Hide Info** - when Hide Info is on, an
  optional persisted "Auto Reveal" toggle blurs each new card's info as
  usual but automatically reveals it after a short, visibly counting-down
  timer - re-arming on every new card (including after pass/fail), not just
  once per session.
- [x] 39. **Search-by-song mode on Add card** - a third search mode alongside
  anime and artist that finds a card directly by song/theme title via
  animethemes.moe's global song search, resolving the chosen result into
  Anime/Artist/Song rows only on click. Built ad hoc in chat (2026-08-31)
  rather than through `/feature`, and added to this plan retroactively on
  2026-09-02 so the checklist matches what shipped.
- [x] 40. **"Cards left" counter on Study** - a live count of due cards
  remaining in the active study scope, next to the existing "Card N this
  session" counter. Built ad hoc in chat (2026-08-31) rather than through
  `/feature`, and added to this plan retroactively on 2026-09-02.
- [x] 41. **Configurable local cache for streamed clips** - a size-capped
  local disk cache (default 1GB, adjustable in Settings) for remote
  animethemes.moe video/audio clips played directly from the CDN, so a clip
  that's been played before (a failed card in particular keeps resurfacing)
  serves from local disk instead of re-fetching from the remote CDN every
  time. Evicts least-recently-used entries once full. Also prefetches in the
  background: a card's own clip as soon as it's loaded, plus (in Study) the
  next 2 upcoming due cards in the queue, so clips are typically already
  cached by the time the user actually reaches them. Local-file cards are
  unaffected (already local).
- [x] 42. **Download fallback when playback fails** - when a card's
  video/audio clip fails to load during Study or Preview, show a "Download
  video" / "Download audio" option (for whichever remote source exists and
  isn't already local) right on the error state, reusing the existing
  per-card download action (feature 8) instead of leaving a dead-end error
  message.
- [x] 43. **Playback mode setting (Auto / Audio only)** - a persistent
  Settings option that governs both what plays and what the local stream
  cache fetches. Auto (default) keeps today's behavior (video when
  available, else audio). Audio only forces every card to play audio-only
  regardless of a local/remote video source, and stops feature 41's cache
  from prefetching or storing video going forward - trading video playback
  for meaningfully lower local storage/bandwidth use. Takes effect from the
  next card presented, never mid-playback of the current one - the exact
  reactive-swap mechanism that caused feature 18's double-audio bug and its
  rollback.
- [x] 44. **Cover image for audio-mode cards, with a Hide Cover toggle** -
  when a card has no video playing this session (naturally audio-only, or
  the Audio Only setting), show the anime's cover image where video
  normally shows, with the ambient glow sampling its colors instead of
  turning off. A new session-only "Hide Cover" toggle (like Hide Info) can
  turn it off, defaulting to shown. The Hide Video toggle on an otherwise
  video-capable card is unaffected - it keeps today's plain veil.
- [x] 45. **Audio visualizer overlay on the spinning record** - when a card
  shows its cover art (feature 44), overlay a transparent, real-time
  frequency visualizer around the spinning record, reactive to actual audio
  playback via the Web Audio API - replacing the "Listening.../Paused"
  feedback that already disappears in cover-art mode.
- [x] 46. **Auto Reveal modes + settings popup** - replace the single Auto
  Reveal on/off toggle with a Video / Info / Both mode choice, moved into a
  small settings popup (alongside its interval) instead of extra buttons in
  the display-toggles row. Turning on a mode forces its target Hide
  toggle(s) on immediately and again at the start of every new card,
  overriding any manual Hide Video/Hide Info/Hide Cover change made
  mid-card; switching mode or turning Auto Reveal off reverts whichever
  toggle(s) it had forced back off.
- [x] 47. **Artist search + categorized results in global search** - the
  nav search bar adds two live-search categories alongside today's local
  "Cards" matches: "Artists" (animethemes.moe artist search, jumps to that
  artist's resolved catalog on `/cards/new`) and "Anime" (today's "Add a
  show" AniList lookup, relabeled and always shown rather than gated
  behind Cards being empty). Local Cards matching is untouched.
- [x] 48. **Standalone platform-agnostic packaging** - a self-contained
  executable per OS/arch (Windows, macOS x64/arm64, Linux) built via `bun
  build --compile`, bundling the Nitro server and opening the user's
  default browser on launch. Relocates the SQLite DB to an OS-appropriate
  user-data directory so the app runs without a separate Node/Bun/Nuxt
  install. Revisits the idea previously scoped as feature 25 ("Standalone
  desktop packaging"), abandoned 2026-08-30 before any code was written;
  this is a new feature, not a reuse of that retired number.
  - [x] 48a. **User-data-directory storage relocation** - make the SQLite
    DB path (`server/db/client.ts`'s `DB_PATH`) environment-aware: an
    optional `GAQ_SRS_DATA_DIR` env var overrides today's project-relative
    `.data/gaq-srs.db` default. `MediaLibrarySettings` (library paths,
    default download folder, stream cache) lives in that same DB and
    relocates automatically with it - no separate change needed. No OS
    detection or launcher yet; testable entirely within the dev workflow
    by setting the env var by hand.
  - [x] 48b. **Launcher entrypoint + single-platform compile proof** - a
    new entrypoint that computes the OS-appropriate user-data directory
    (Windows/macOS/Linux), sets `GAQ_SRS_DATA_DIR` from it, starts the
    built Nitro server, and opens the user's default browser once it's
    listening. Compiled via `bun build --compile` for the current dev
    machine's OS/arch only, proving the mechanism end to end (including
    `better-sqlite3`'s native addon and the migrations folder actually
    working from a compiled binary) before multiplying it across targets.
  - [x] 48c. **Full OS/arch build matrix** - extends 48b's proven compile
    step to every target (Windows, macOS x64/arm64, Linux) with a build
    script and documented release process. Code-signing/notarization
    (macOS Gatekeeper, Windows SmartScreen) is out of scope - unsigned
    binaries will show an OS security warning on first run.
- [x] 49. **Unify card search with Add Card** - `/cards`' own search (feature
  35a, already matching song/artist/anime-title) becomes the one surface for
  finding an existing card or adding a new one, replacing three separate
  entry points (NavBar's dropdown, the deck-detail add flow, and the
  standalone `/cards/new` page) with one. Local matches are always shown
  first; Artist/Anime/Song add-candidates run in parallel alongside them
  (ordering only, not gated on local being empty - keeps feature 47's
  already-parallel approach rather than reintroducing the older gated
  behavior). Built additively in phases: `/cards/new` and every existing
  entry point to it stay untouched until the new surface is proven, then a
  final sub-feature retires the page and rewires callers.
  - [x] 49a. **Anime + Song add-candidates on /cards** - extends `/cards`'
    search to also run the AniList anime lookup and the animethemes song
    lookup in parallel with the existing local search, rendered as two
    groups below local matches. Anime results expand inline into a
    theme-picker (per-theme "Add", reusing `/api/lookup/import` +
    `POST /api/cards`, same as `/cards/new`'s anime mode today). Song
    results add in one click (`/api/lookup/song-search` +
    `/api/lookup/song-import`, same as `/cards/new`'s song mode today).
  - [x] 49b. **Artist add-candidates + bulk preview modal** - adds the third
    group, backed by `/api/lookup/artist-search`; picking a result resolves
    the artist's full catalog (`/api/lookup/artist-import`) into a modal
    (generalizing the `DeckAddAnimeModal` pattern from feature 33, but for
    an artist's multiple anime and not deck-scoped) with per-theme "Add",
    "Add all", and "Download all" - the same bulk actions `/cards/new`'s
    artist mode has today.
  - [x] 49c. **Retire /cards/new** - once 49a/49b are in place, deletes the
    `/cards/new` page and rewires its six existing entry points (NavBar's
    three query-param navigations, `/cards`' header and empty-state links,
    and the empty-state links on `/stats` and `/decks`) to the unified
    `/cards` search instead.

- [x] 50. **Visual redesign (Akiba Neon)** - move off the current vertical
  single-column layout to a rail nav with split panes, and retheme from the
  purple/rounded look to the canvas's blue-black + sakura + cyan with tight
  radii. The design reference is
  `blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`
  (see that folder's `README.md` for how to use it, plus an open decision on
  Study's fullscreen/ambient overlay unrelated to any single sub-feature
  here). Direction 1A was chosen over the alternative 1B "Jukebox"
  study-screen take. Added 2026-09-02; the design reference was replaced
  2026-09-03 (the original single-canvas decode, `akiba-neon-canvas.html`,
  is superseded and removed - this folder covers every screen it did, plus
  more).
  - [x] 50a. **Theme tokens + app shell** - port the palette, type and radii
    into `main.css`, and build the rail nav plus shared chrome. Every later
    sub-feature builds on this, so it goes first.
  - [x] 50b. **Study screen** - 1A's treatment: keeps today's player + side
    info panel, collapses the display-toggle row into one icon strip.
  - [x] 50c. **Cards** - dense table + inspector rail, row actions demoted.
    Carries an open decision: 1A draws Add card as a standalone page with
    Anime/Artist/Song tabs, which is the architecture feature 49 deleted.
    Prefer restyling feature 49's unified `/cards` search with 1A's
    split-pane layout; reinstating a separate page is a deliberate partial
    reversal of 49 and needs to be chosen, not defaulted into.
  - [x] 50d. **Decks** - poster grid, covers carrying the layout.
  - [x] 50e. **Stats** - dashboard with KPI tiles and a reviews/pass-rate
    chart.
  - [x] 50f. **Home** - dashboard replacing the five link cards.
  - [x] 50g. **Settings** - section rail + two columns.
  - [x] 50h. **Narrow-window pass** - rail collapses to icons, split panes
    stack, tables drop columns.

- [x] 51. **Previous card navigation in Study** - lets you step back to a
  previously presented card in the current session to review it again,
  view-only (does not re-submit a review or change its Leitner box/interval)
  - alongside today's forward-only due-card queue.
- [x] 52. **Study session log** - a visible list of cards presented so far
  in the current session (song/artist/anime, pass/fail result), likely the
  surface "Previous" navigation (51) steps back through.
- ~~53. **Immersive study mode: bottom bar layout**~~ - abandoned
  2026-09-18. Built 2026-09-03 (the `#2b` "Bottom bar" candidate from
  `blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`,
  replacing feature 31's overlay-style immersive mode), then rolled back
  the same day; see
  `blueprint/history/rollbacks/2026-09-03-53-immersive-study-bottom-bar.md`.
  A follow-on fix then removed `/study`'s immersive and expand modes
  entirely rather than restoring feature 31's overlay - the mechanism
  survives only in `CardPreviewModal` (reached from `/cards` and
  `/decks`). Dropped from the roadmap entirely rather than redesigned a
  third time. Not a build target; number retired, not reused, joining
  18/25/32.
- [x] 54. **Update checker** - stamps a real version into the app and the
  packaged build (nothing carries one today), then checks the GitHub
  releases API on launch for a newer tag and surfaces an "update available"
  notice with a link to the release page. Cached and fail-quiet: a rate
  limit, an offline machine, or a GitHub outage leaves the app working
  exactly as it does now, with no error surfaced. Does not download or
  replace the running binary - a build is an executable plus three sibling
  folders, and Windows cannot overwrite a running .exe while macOS needs
  re-signing after a swap, so self-replacement is a separate feature if it
  is ever wanted.
- [x] 55. **Bulk add-all + download-all parity for anime search results** -
  the Anime add-candidate group on `/cards` gains the same bulk actions the
  Artist group already has (feature 49b): an "Add all" button that adds
  every theme for the expanded anime in one action, and a "Download all"
  button that downloads every added card's remaining source. Also extends
  both groups' "Download all" to cover audio as well as video - today it's
  video-only even for artists.
- [x] 56. **Card notes (Migaku-style memory notes)** - a free-text notes
  field per card, editable from the existing Edit surfaces
  (`CardPreviewModal`, `/study`'s `StudyCardEditPanel`, and `/cards`'
  inspector edit form), shown in `StudyInfoPanel` during Study and Preview
  as a personal mnemonic aid (subject to the same Hide Info blur as the
  rest of the panel).
- [x] 57. **Ultrawide/large-screen layout cap** - past roughly 2560px of
  viewport width, aspect-locked and fixed-width surfaces (Study's video
  pane, its 480px info column) grow into unbounded dead space instead of
  more usable layout. Caps and centers the app's main content column above
  that width; every screen's existing full-bleed look stays completely
  unchanged below it.
- [x] 58. **Import from AniList/MyAnimeList (Completed list)** - enter a
  username; fetches the public Completed-status anime list from AniList
  and/or MyAnimeList (via the unofficial Jikan API, since MAL's official
  API requires OAuth even for public-list reads) and surfaces each anime as
  a browsable add-candidate (title, cover, already-added check) in the same
  picking flow as the existing Anime search group on `/cards` - no
  automatic bulk card creation, no OAuth, no stored account link.
- [x] 59. **Auto Download setting** - a persistent Settings toggle (default
  off) that, while a card is loaded in Study or Preview, automatically
  downloads its clip into the local media library - video when Playback
  mode (feature 43) is Auto and the card has a video source, audio
  otherwise - instead of relying on the manual per-card Download button or
  feature 41's streamed/cached playback. A no-op, with no error surfaced,
  when no default download folder is configured or the card already has a
  local file for the chosen kind.
- [x] 60. **AnisongDB as the primary lookup and media source** - adding a
  card and first-playing a clip are slow because animethemes.moe answers
  with 1-3s media TTFB and roughly 0.75s GraphQL search. Adds AnisongDB
  (https://anisongdb.com, the public API behind Anime Music Quiz) as the
  preferred source for OP/ED metadata and clip URLs, keeping
  animethemes.moe as the fallback for anything it does not cover. Every
  AnisongDB entry carries a `linked_ids.anilist`, so it maps onto the
  existing AniList-keyed schema with no new ID system. No new setting: the
  preference is automatic, with silent fallback.
  - [x] 60a. **AnisongDB client + anime theme import** - the API client,
    theme-slot mapping, the media host allowlist for AMQ's distribution
    servers, and `/api/lookup/import` preferring AnisongDB themes.
  - [x] 60b. **Song and artist search** - repoints
    `/api/lookup/song-search`, `/api/lookup/artist-search`, and
    `/api/lookup/artist-import` at AnisongDB with the same fallback.
  - [x] 60c. **Re-source existing remote-only cards** - a Settings action
    that re-resolves cards still holding animethemes.moe URLs and no local
    file, swapping in the faster host where a confident match exists.
- [x] 61. **Card deletion and bulk delete** - multi-select on `/cards` with
  select-all, a bulk Delete action and a Delete-all-matching action, both
  behind a confirm, plus a Delete action on `/decks` detail rows. Deleting
  also clears the card's cached stream files, which today outlive the card
  they were fetched for. Orphaned `Song`/`Artist`/`Anime` rows are
  deliberately kept as a local metadata cache, so re-adding an anime later
  does not pay for a fresh AniList/AnisongDB lookup.
  - [x] 61a. **Stream-cache cleanup + bulk delete endpoint** - extend
    `deleteCard()` to remove the card's cached stream files alongside the
    local files it already cleans up, and add a batched delete accepting
    many ids in one request.
  - [x] 61b. **Multi-select + bulk delete UI on /cards** - per-row
    checkboxes, a select-all control, a selection action bar, and a
    two-step confirm.
  - [x] 61c. **Delete-all-matching + deck-detail parity** - delete every
    card matching the active search, and a Delete action on `/decks`
    detail rows.
- [x] 62. **Cute/moe soft retheme** - replace Akiba Neon's harsh arcade look
  with a cute, moe, lo-fi one: gruvbox-inspired soft dark palette (warm
  charcoal ground, cream text, muted pastel accents), playful handwritten
  Japanese-capable fonts, and rounder corners. Returns to the cute/moe
  direction build 50 moved away from, now prioritized over the Akihabara
  arcade style. A retheme only - no data model, route, layout, or behaviour
  changes apart from removing the rail's logo tile. The look is locked first in a design mockup saved under
  `blueprint/reference/`, then ported.
  - [x] 62a. **Palette, fonts, and radii tokens** - port the approved
    mockup's colors (including glow, glass, and shadow tokens), fonts, and
    radii into `main.css` and the Google Fonts link, retheming every
    token-driven surface at once, and removes the rail's logo tile.
  - [x] 62b. **Hard-coded color sweep + contrast pass** - replace the literal
    colors still inside components (modal backdrops, the player's error and
    loading veils, the visualizer ring stroke, the record texture) with
    tokens, then check text, badges, focus rings, active tabs, and
    pass/fail on every screen for legibility on the new ground.
- [x] 63. **Mascot (Temi)** - add the app's mascot, Temi (a pink-twintailed
  girl in headphones at a quiz-buzzer desk), as optimized image assets: a
  face-crop favicon and touch icon, the hero art on Home, and a small
  companion on the "all caught up" and empty-library states. Source image
  saved under `blueprint/reference/mascot/`. No data, route, or behaviour
  changes.
- [x] 64. **Clip source setting** - a persistent Settings choice in the
  Playback section for where clip files (video/audio) may come from:
  AnisongDB only (default), Both (AnisongDB preferred, animethemes.moe as
  fallback, today's behaviour), or animethemes.moe only. It governs clip
  URLs only; animethemes.moe metadata (native song titles, theme ids) is
  still used in every mode. Applied where clip URLs are chosen (anime,
  song, and artist import, deck import) and enforced where they are fetched
  (stream, prefetch, download), so a card holding a URL from an excluded
  host never streams or downloads from it. Revises feature 60's "no new
  setting" decision: clips were still reaching animethemes.moe through
  60a's per-kind and unmatched-theme fallbacks.
  - [x] 64a. **Setting + fetch-time enforcement** - the stored setting and
    its Settings control, and `/api/media/stream`, `/api/media/prefetch`,
    and `/api/cards/download` refusing a URL whose host the setting
    excludes.
  - [x] 64b. **Import-time clip filtering** - anime, song, and artist
    import and deck import keep only allowed clip URLs; a theme left with no
    allowed clip still shows in results, disabled, with a note saying why.
  - [x] 64c. **Existing cards under a narrower setting** - Study and
    Preview skip a blocked URL (playing the other kind when it is allowed),
    a card with nothing allowed shows the existing error state with a hint
    pointing at the 60c re-source action, and that action honours the
    setting. Stored URLs are never deleted.

- [x] 65. **Typed anime answers on Study** - optional, remembered answer mode
  with online anime autocomplete, automatic Pass/Fail grading, an explicit
  answer-result/continue phase, and session score/combo feedback. Suggestions
  include anime outside the local library; submitted answers leave the song
  playing until the user continues.
- [x] 66. **Multi-category typed answers** - extend Typed Answers (feature 65)
  with an optional sub-menu of additional guessable categories beyond the
  anime title, each scored independently as bonus points on top of the
  existing anime-guess score/combo. Anime name stays on by default and
  cannot be turned off; Song name and Opening/Ending number are off by
  default and independently toggleable. Only the anime-name result still
  drives the card's SRS pass/fail; bonus categories never change scheduling
  or accuracy stats, only add optional bonus points.
  - [x] 66a. **Category settings menu + Opening/Ending number category** - a
    settings popup (mirroring Auto Reveal's) to toggle Song name and
    Opening/Ending number on/off, remembered like the Typed Answers
    preference; adds the Opening/Ending category itself, a compact
    Opening/Ending + number picker graded against the card's exact theme
    slot, shown as its own correct/wrong row in the result panel with flat
    bonus points added to the session score. With every extra category off
    (today's default), Study behaves byte-for-byte like it does now.
  - [x] 66b. **Song name category** - adds the Song name category: a
    redacted song search-as-you-type (title/artist shown, anime identity
    withheld to avoid spoiling the anime guess) graded by exact song-title
    match against the card, reusing 66a's settings menu, shared submit
    flow, and bonus-scoring framework.
- [x] 67. **Dynamic scoring feedback on Study** - make typed-answer scoring
  feel energetic and arcade-like instead of a static number in the header.
  A "+N" score burst animates over the player where the answer was given and
  flies toward the session score chip before fading; the chip's own total
  counts up to its new value with a pulse; a growing combo gets escalating
  emphasis; and each bonus category's points pop in staggered rather than all
  appearing at once in the result panel. Presentation only - no change to
  point values, grading, SRS scheduling, or any stored shape, and every
  animation is suppressed under `prefers-reduced-motion`.
- [x] 68. **Deeper review stats** - turn `/stats` from three KPI tiles, one
  chart, and a breakdown list into a real analytics page, using only data
  already on disk: `review_log`'s `boxBefore`/`boxAfter` and the clock time
  of `reviewedAt`, plus `card`'s `box`/`streak`/`nextReviewAt`, none of
  which the stats queries read today. Sectioned single page in the existing
  panel styling, every stat retroactive over the full review history. No
  schema change, no new logging, and no change to what Study records.
  Deliberately goes deeper than Home's "Last 30 days" and "Weakest decks"
  panels rather than restating them.
  - [x] 68a. **Collection health + review forecast** - a box 1-5
    distribution (showing box 1's streak-to-graduate progress, since
    `boxOneStreakRequired` means box 1 is a multi-pass stage, not one
    step), percent mature, a never-reviewed count, and a due-cards
    forecast for today, the next 7 days, and the next 30.
  - [x] 68b. **Retention by box + trends** - pass rate per `boxBefore` (is
    box 5 actually holding?), a 7-day rolling average on the existing
    reviews chart, a week-over-week pass-rate delta, most-improved and
    most-declined decks by recent-versus-older rate, and an OP versus ED
    split by `themeSlot`.
  - [x] 68c. **Activity heatmap + records** - a calendar heatmap of review
    volume, hour-of-day and weekday performance read from `reviewedAt`'s
    time component, and a records panel: longest streak ever (today's KPI
    only shows the current one), best single day, and total days studied.
  - [x] 68d. **Leeches and trouble cards** - the cards actually costing
    you: worst by fail count, current fail streak, and a separate
    never-passed list, each row opening the existing `CardPreviewModal` so
    a problem card can be acted on without leaving the page.
- [x] 69. **Homepage study activity heatmap** - add a GitHub-contribution-style
  calendar heatmap to Home's dashboard, showing cards studied (review count)
  per day over roughly the past year, colored by relative intensity, with a
  hover tooltip giving the exact date and count. Purely additive next to the
  existing "Last 30 days" panel - no changes to what Study or the review log
  record, no schema change; reads the same `reviewedAt` data the existing
  timeline chart already reads.
- [x] 70. **Filter cards without an AnimeThemes.moe match** - identify and
  clean up cards whose theme was only ever resolved via AnisongDB, without
  changing which host serves any card's clip (Clip source, feature 64, is
  untouched).
  - [x] 70a. **Library filter + bulk cleanup** - a toggle on `/cards` that
    narrows the list - and its "Delete all N matching" bulk action - to
    cards whose song has no AnimeThemes.moe match, reusing feature 61's
    bulk-delete machinery.
  - [x] 70b. **Import-time gate** - an AnisongDB-only result in the
    Anime/Song/Artist add-candidate search shows disabled with a note
    explaining why, mirroring feature 64b's pattern, instead of being
    addable like normal.
- [x] 71. **Per-deck grading criteria** - let a manual deck declare what its
  cards are graded on - the anime title (today's behaviour, and the default),
  the song name, or both - and give each criterion its own Leitner scheduling
  track, so the same card can sit in one deck you drill for titles and another
  you drill for song names without either deck's pass/fail moving the other's
  interval. Artist and Anime decks are query-time groupings with nowhere to
  store a setting, so this is manual-deck-only; every existing deck keeps
  grading by title and keeps the exact scheduling state it has now.
  - [x] 71a. **Criterion-keyed scheduling tracks** - the schema and server
    plumbing, with no way to set a criterion yet, so the app behaves exactly
    as it does today. A `gradingCriterion` on `deck`; a `card_track` table
    holding box/streak/nextReviewAt per (card, criterion) for non-title
    criteria only, so the `card` row stays the title track and nothing is
    backfilled; a `criterion` column on `review_log` defaulting to `title`.
    The due query, due count, prefetch lookahead, new-card counting and
    `recordReview` all resolve a criterion from the study scope and operate on
    that track. Stats, Home and the deck tiles filter to the title track so
    their numbers keep meaning what they mean today.
  - [x] 71b. **Deck criterion setting + Study grading** - the control that
    sets a manual deck's criterion on `/decks`, and Study actually grading by
    it. With Typed Answers on, the criterion's categories are forced on and
    drive Pass/Fail, a blank required answer counting as a fail; with it off,
    the manual prompt re-words to name what you are grading yourself on. The
    info panel's box and learning-streak readout follows the active track.
  - [x] 71c. **Track-aware stats** - slice `/stats` and the deck pass-rate
    tiles by criterion instead of hiding non-title tracks, so song and
    combined drilling shows up in retention, leeches and the activity charts.
- [ ] 72. **Combined grading criteria** - extend feature 71 so a manual deck
  can grade on any combination of the anime title, the song name, the
  Opening/Ending number, and the artist, instead of only title, song, or
  both. Each combination is its own Leitner track, exactly as 71's three
  are. The OP/ED number can only be graded alongside the anime title, since
  "OP2" means nothing without knowing which show. Still manual-deck-only;
  every existing deck keeps its criterion and scheduling state.
  - [x] 72a. **Combination criteria in the data and server** - a criterion
    becomes a canonical `+`-joined set in fixed order (`title`, `song`,
    `title+slot+artist`, ...). A migration renames stored `both` to
    `title+song` in `deck`, `card_track` and `review_log`, so nothing else
    changes meaning. Validation (deck PATCH, review POST, stats `track`)
    accepts any valid combination and rejects `slot` without `title`. No
    new UI, so the app behaves as it does today.
  - [x] 72b. **Deck control + Study grading for OP/ED and artist** - `/decks`
    swaps the three-way criterion toggle for four category checkboxes. In
    Study with Typed Answers on, a required OP/ED number forces the existing
    OP/ED picker on and counts toward Pass/Fail. A required artist shows a new
    free-text artist box, matched like song names (case- and
    space-insensitive, no fuzzy matching). With Typed Answers off, the manual
    prompt names every required category.
  - [ ] 72c. **Stats for combined tracks** - `/stats`' Track selector and the
    deck tiles list and label whichever combinations have data, instead of
    the fixed Anime title / Song name / Both.

## Plan maintenance

Not features and not build targets - documentation drift to correct in
`project-plan.md` whenever it is next edited. Deliberately plain bullets,
never checkboxes, so `/feature` can't mistake one for the next item to build.

- ~~`project-plan.md` §7 (UI/UX) omitted Hide Cover (feature 44) and the Auto
  Reveal control (features 38/46) from the study screen's display toggles.~~
  Corrected 2026-09-02; §7 now lists both. Kept here as a worked example of
  what belongs in this section.
- ~~`project-plan.md` §7 described the study screen as having an `E`-hotkey
  immersive mode with a bottom bar (build 53), and `project-overview.md`
  described build 31's overlay as live on `/study` in several places.~~
  Corrected 2026-09-04. Build 53 was rolled back and a follow-on fix removed
  `/study`'s immersive and expand modes entirely; the mechanism survives only
  in `CardPreviewModal`. Both docs now say so.
- ~~`project-overview.md` described builds 57 and 58 as "not yet built" though
  both were checked off here and archived, and both it and `project-plan.md`
  §5 named Jikan as the MyAnimeList list source.~~ Corrected 2026-09-13. The
  `mal-list-direct-lookup` fix (2026-09-12) replaced Jikan with MyAnimeList's
  own public list endpoint after MAL began refusing Jikan's scrape with a
  permanent 504, and `server/lib/jikan.ts` was deleted; both docs now say so.
  Item 58's own line below still describes the Jikan plan as approved at the
  time and is deliberately left as written, since the checklist records what
  was planned, not what the shipped code does.
- Build 53's checkbox is unchecked but it is not a pending build target: the
  feature was built, rolled back, and the surface it replaced no longer
  exists. Retiring the number (as 18, 25, and 32 were retired) or rebuilding
  it is an open roadmap decision, deliberately left to the user rather than
  resolved by a documentation pass.
