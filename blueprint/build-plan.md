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
- [ ] 53. **Immersive study mode: bottom bar layout** - replaces feature
  31's current immersive overlay (card info floated directly on top of the
  video) with the `#2b` "Bottom bar" candidate from
  `blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`:
  the video stays completely clean while playing, and everything -
  scrubber, volume, language toggles, title/song/artist/theme info, and
  Fail/Pass - moves into a horizontal bar underneath it instead. Reskinned
  to the app's shipped Akiba Neon tokens (`main.css`), not the mockup's
  Nocturne tokens. Resolves the open Study fullscreen/ambient-overlay
  decision left unresolved by build 50 (see 50's entry above and the
  design reference's `README.md`). Applies everywhere feature 31's
  immersive mode applies today: `/study` (with Fail/Pass) and
  `CardPreviewModal` (info only, no review controls, matching today).
  **Rolled back 2026-09-03** - reverted to feature 31's overlay-style
  immersive mode; see
  `blueprint/history/rollbacks/2026-09-03-53-immersive-study-bottom-bar.md`.
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

## Plan maintenance

Not features and not build targets - documentation drift to correct in
`project-plan.md` whenever it is next edited. Deliberately plain bullets,
never checkboxes, so `/feature` can't mistake one for the next item to build.

- ~~`project-plan.md` §7 (UI/UX) omitted Hide Cover (feature 44) and the Auto
  Reveal control (features 38/46) from the study screen's display toggles.~~
  Corrected 2026-09-02; §7 now lists both. Kept here as a worked example of
  what belongs in this section.
