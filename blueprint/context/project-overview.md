# GAQ SRS - Project Overview

<!-- blueprint:source-hash 160ddead3b9baa467e977122741bd386023366fc4976f791906e34d2825beb22 -->

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

Build-plan order. Features 1-17 and 19-24 (the full MVP, manual decks, the
study-screen ambient glow, the home page/nav bar, Preview editing, delete
cleanup, pagination/search, Preview expand + ambient mode, the volume
slider, deck-detail Preview, Study's own expand toggle, and the
ambient-driven glass surface) are built and merged, as are 26-31 and 33-38
(global search find+add, clear-local-file, add-existing-cards-to-deck,
stats refresh+clear, native Japanese titles + split furigana toggle, the
immersive study mode, add-new-anime-from-a-deck, deck assignment from card
edit, library search + infinite scroll in all three sub-features, unifying
Preview's expand mode with Study's immersive overlay, bulk artist import
in its two sub-features - 37a artist search + theme resolution, 37b bulk
card creation + download - and the auto-reveal timer for Hide Info).
Features 39 and 40 (search-by-song mode and a study "cards left" counter)
were built ad hoc directly in chat rather than through the `/feature`
workflow, so they were missing from `build-plan.md` for a time; this
overview recorded them from 2026-08-31, and they were added to the
checklist retroactively on 2026-09-02 so both plans match what shipped. Features 18, 25, and 32 were each abandoned outright (see their
entries below) - all three numbers are retired, not reused: 18 was built,
then rolled back, then dropped; 25 was dropped before any code was
written; 32 was spec'd and partially implemented, then dropped before any
code was committed to master. Features 41 and 42 (a capped local cache for
streamed clips and a download fallback when playback fails) were added to
`build-plan.md` on 2026-08-31 and are now both built and merged. Feature 43
(a persistent Auto/Audio-only playback mode setting, unifying playback
choice with feature 41's cache behavior) was added to `build-plan.md` the
same day as a deliberate third attempt at the idea behind the abandoned
features 18 and 32 - resolved once per card load rather than reactively,
to avoid feature 18's overlapping-audio failure mode - and is now built and
merged. Features 44-46 (a cover image with a Hide Cover toggle, an audio
visualizer ring on the resulting spinning record, and an Auto Reveal
mode/settings-popup redesign) were added to `build-plan.md` on 2026-08-31
and 2026-09-01 and are now all built and merged, along with several
same-day fixes layered on top of 46 (Auto Reveal decoupled from Hide Info,
made pausable with playback, stopped from re-hiding an already-revealed
card, and given a working, properly-scaled countdown in immersive mode -
see feature 46's entry below). The Hide Video toggle (feature 10) is
deliberately unaffected by feature 44 - it keeps today's plain veil on an
otherwise video-capable card. Feature 47 (two new live-search categories -
Artists and Anime - in the nav bar's global search dropdown) was added to
`build-plan.md` on 2026-09-01 and is now built and merged. Feature 48
(standalone platform-agnostic packaging, in three sub-features 48a-48c)
was added to `build-plan.md` the same day and is now built and merged,
plus several fixes layered on top of it since (see feature 48's entry
below) - it revisits the idea previously scoped as feature 25 ("Standalone
desktop packaging"), which was abandoned 2026-08-30 before any code was
written; 48 is a new feature, not a reuse of that retired number, and
`project-plan.md`'s Deployment section (§8) was updated to match,
replacing its prior "no packaged build is planned" statement. Feature 49
(unifying card search with Add Card, in three sub-features 49a-49c) was
added to `build-plan.md` on 2026-09-02 and is now built and merged in
full, retiring the `/cards/new` route - a same-day follow-on also removed
`/cards`' leftover "Add card" header button, which after 49c only focused
the search box directly below it.

1. **Data layer** - done. SQLite schema (Drizzle ORM) for anime,
   songs/themes, cards, and review history.
2. **Media library settings** - done. `/settings` - configure local/external
   folders the app reads clip files from.
3. **Anime & song lookup** - done. `/api/lookup/*` - search AniList and
   animethemes.moe (both GraphQL) and cache metadata (EN/Romaji/JP titles,
   artist, OP/ED themes) into the local DB.
4. **Flashcard CRUD** - done. `/cards` - create/edit/delete cards from
   looked-up song data; attach a local file and/or an animethemes.moe
   reference. Originally split across `/cards` and a separate `/cards/new`
   page; feature 49 folded that page's add flows into `/cards`' own search
   box and deleted the route. A same-day fix (2026-08-31) closed a
   duplicate-card gap: `POST /api/cards` (`createCard`) now rejects a
   second card for a song that already has one, and every add flow
   pre-marks an already-added song as "Added" (via `GET
   /api/cards/by-songs`) as soon as its anime/artist/song search result
   loads, instead of showing an addable button that would just error on
   click.
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
   setting (`/settings`) plus a download action on `/cards` (including its
   add-candidate result groups)
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
    backdrop click, or `Escape`. Originally deferred on the separate
    `/cards/new` page; feature 49 retired that page, and all three of
    `/cards`' add-candidate groups now emit `preview` up to this same
    single modal instance. Its
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
      "Remove" action. Not offered inside `/cards`' add-candidate result
      groups (feature 49) - a just-added card picks the panel up from its
      own row once the local list refreshes. A same-day fix
      (2026-08-31) stopped that checkbox panel from rendering twice on
      `/cards` when a card's "Decks" panel was left open and then its
      "Edit" form was also opened - the edit form has its own copy of the
      panel, so the standalone one now hides whenever that card is being
      edited.
14. **Ambient video glow on Study** - done. A soft, blurred, color-sampled
    glow behind the video player on `/study`, active only while a real video
    frame is showing (not audio-only, not Hide Video); covers the whole
    background and is toggleable. Feature 44 later extended the "not
    audio-only" condition: an audio-only/cover-art card now also drives the
    glow, sampled from the anime's cover image instead of turning off - see
    feature 44's entry.
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
18. ~~**Per-scope quiz-mode preference**~~ - abandoned 2026-08-29. Built,
    then rolled back the same day. A settings table keyed by study scope
    (artist id / anime id / "all" - manual decks excluded since `/study`
    can't be scoped to one yet), each independently settable to Auto /
    Audio-only / Video-only. Rolled back because its `forcedMode`
    mechanism let `StudyMediaPlayer`'s `mediaKind` change after playback
    had already started, causing two audio streams to play at once; a
    targeted fix didn't resolve it. See
    `blueprint/history/rollbacks/2026-08-29-18-per-scope-quiz-mode-preference.md`.
    Dropped from the roadmap entirely rather than redesigned - not a build
    target, and its number is retired, not reused.
19. **Library scale-up: pagination + search** - done, two sub-features:
    - **19a. Pagination** - done. Numbered pages, ~25/page
      (`PAGE_SIZE` in `server/utils/pagination.ts`), on the top-level
      `/cards` list, top-level `/decks` list, and the card list inside a
      deck's detail view, via a `Paginated<T>` server-side return shape
      (still current) and a shared `<Pager>` UI component - later fully
      superseded by feature 35's infinite scroll on all three surfaces;
      `Pager.vue` itself was deleted in 35c once nothing called it anymore.
    - **19b. Global search** - done. An autocomplete dropdown in the
      persistent nav bar (`/api/search`), searching `Card`s only - a result
      hands off to `/cards` via a shared `pendingCardPreview` `useState`,
      pre-opening that card's Preview modal on arrival. Originally also
      searched Artists/Anime/manual Decks and jumped to their `/decks`
      pages; narrowed to cards-only by a fix (see feature 26's entry below)
      after that deck-navigating behavior turned out to be unwanted UX, not
      the search bar's job.
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
24. **Glass surface, automatic with ambient mode** - done. `/study`'s
    player, `CardPreviewModal`'s panel, `StudyInfoPanel`, and shared UI
    chrome (nav bar, search bar, toggle/answer/expand buttons) turn
    translucent and frosted (`backdrop-filter` blur, via plain
    `--glass-surface` / `--glass-border` / `--glass-blur` tokens)
    automatically whenever that surface's own ambient-mode toggle is on -
    an `ambient-glass` class bound directly to each component's existing
    `ambient`/`ambientMode` state, plus a shared `data-ambient-glass`
    attribute (via `useAmbientGlass()`) so components outside that state's
    own tree (the nav bar) can react too. No separate theme setting, no
    persistence, no `/settings` UI. Redirected mid-build from an initial
    standalone Theme picker design (built, verified working, then found to
    read as pointless since most of the app barely visibly reacted to a
    separate toggle) before that version was ever merged. Active-state
    highlights (current nav tab, an "on" toggle, the selected language)
    use a border + glow instead of a solid fill, so they stay glass too.
25. ~~**Standalone desktop packaging**~~ - abandoned 2026-08-30. Never
    started - dropped from the roadmap by user decision before any code
    was written, so there was nothing to roll back. Not a build target;
    its number is retired, not reused. The idea had been a double-
    clickable, per-OS build (no Node/Bun/Nuxt install required) that
    started the local server and opened the user's default browser to
    it, with the SQLite database and media library settings moving to an
    OS-appropriate user-data directory. `project-plan.md`'s Deployment
    section (§8) was updated to match: it now states the app runs only
    via the developer workflow, no packaged build planned.
26. **Global search: find + add shows** - done. The nav search bar
    (`NavBar.vue`) falls back to `GET /api/lookup/anilist-search` when the
    local `Cards` group is empty, showing an "Add a show" dropdown group -
    a single full-width button per AniList match, same pattern as the
    `Cards` group's own result buttons. Clicking one originally navigated
    to `/cards/new?aniListId=<id>`, which read that param on mount and
    auto-triggered the existing `selectAnime` import flow - no new server
    routes, no duplicated theme-list UI. Pressing Enter in the search box
    (2+ characters) handed off to `/cards/new?q=<query>` instead, which
    auto-ran that page's existing manual AniList search. Feature 49c
    retired that page and repointed both at `/cards?q=<text>` (see feature
    49's entry). A same-day fix
    (`blueprint/history/fixes/narrow-global-search-to-cards.md`) removed
    the dropdown's Artists/Anime/manual-Decks groups entirely (search is
    cards-only now) and moved this fallback's trigger from the removed
    `anime` group to the `Cards` group being empty; placeholder text reads
    "Search Anime".
27. **Explicit "Clear local file" action on cards** - done. A "Clear"
    button next to each local video/audio path field (in both `/cards`'
    row edit and `CardPreviewModal`'s edit mode, feature 16) PATCHes just
    that field to `null` and deletes the file via the same
    `deleteFileIfUnreferenced()` helper feature 17's card delete already
    uses. That cleanup now runs for *any* explicit clear-to-`null` through
    `PATCH /api/cards` - including the pre-existing "blank the text input,
    then Save" flow, not just the new buttons - so both ways of clearing a
    path behave the same. The existing "needs at least one source"
    validation is unchanged and still blocks clearing a card's only
    remaining source.
28. **Add existing cards to a deck from the deck page** - done. Manual
    decks only (artist/anime decks are derived, not stored). A search box
    on a manual deck's detail view (feature 13a) queries the cards-only
    `/api/search` (feature 26's fix); each result shows "Add" or an
    "Added" badge, checked against `/api/decks/memberships`'s site-wide
    map (not the deck's own paginated card list) and attached via the
    same `POST /api/decks/cards` feature 13b's `/cards`-side checkbox
    panel already uses - initiated from the other direction, no server
    changes needed.
29. **Stats refresh + clear** - done. A "Refresh" button on `/stats` re-runs
    both existing stats fetches (overall summary + the active By Artist/By
    Title list) without a full page reload. A new `POST /api/stats/clear`
    route deletes every `ReviewLog` row (stats reset to zero; `Card.box`/
    `Card.nextReviewAt` are untouched, since those live on `Card`, not
    `ReviewLog`), gated behind an inline two-step confirm (this app's first
    confirm pattern - card/deck delete are both one-click) and disabled when
    there's nothing to clear.
30. **Native Japanese song titles + split Furigana toggle** - done. Adds a
    native-Japanese `titleNative` column to `Song` (alongside the anime
    title fields that already exist on `Anime`), populated from
    animethemes.moe's `song.title.native` field on import and exposed as a
    never-null `songTitleNative` on the shared `CardWithDetails` shape
    (falls back to `Song.title`, mirroring how `Anime.titleNative` already
    behaves). Splits the old single "JP + Furigana" toggle (feature 6c) on
    Study/Preview into an independent Japanese toggle plus a Furigana
    sub-toggle, applying to both anime and song titles.
31. **Immersive expanded study mode** - done. Replaces the retired
    "settings panel" idea (a version of this feature was built, then
    explicitly rolled back after several placement attempts didn't land -
    see the `study-player-polish` fix archive). An `E` hotkey toggles an
    immersive expanded mode that overlays everything that was on the side
    info card (titles, artist, language toggles - feature 6c, as split by
    feature 30) directly on the video instead of showing it beside the
    player, with Pass/Fail also part of the overlay. Unlike the earlier
    expand toggle (feature 23), staying immersive carries across moving to
    the next card rather than resetting per card - immersive state moved
    from `StudyMediaPlayer.vue` (remounts every card) up to
    `study/index.vue` (page-level, survives card transitions) to make that
    possible. The `i` hotkey keeps its existing blur behavior (feature 10)
    outside immersive mode; while immersive, `i` instead shows or hides the
    overlaid info entirely (no blur - a plain visibility toggle). The
    display toggles (Hide Video, Hide Info, Random Start, Ambient mode) and
    language toggles stay inline on the study screen either way, with the
    `H` hotkey + icon (from the `study-player-polish` fix) to hide/show
    them together.
32. ~~**Study playback-mode option**~~ - abandoned 2026-08-30. Spec'd and
    partially implemented (a `playbackMode` prop on `StudyMediaPlayer.vue`
    plus an immersive-overlay control), then dropped by user decision
    before any commit landed on master - nothing to roll back. Not a
    build target; number retired, not reused. Original scope: in the
    immersive overlay from feature 31, a session-only choice (not
    persisted per scope, unlike the abandoned feature 18) between
    Audio-only / Video-only / Any (locals preferred).
33. **Add new anime cards from a deck page** - done. A manual deck's
    detail view can create a brand-new card straight from an AniList
    lookup, not just attach cards that already exist (feature 28's job).
    Revised after first-pass review into a single unified search box
    (merged into the existing "Add cards" box) that searches local cards
    first and falls back to an AniList search - picking an anime never
    navigates away from the deck page; closing the flow (Cancel or Done)
    always lands back on the deck page, since the user never left it.
34. **Deck assignment from card edit / Preview edit** - done. A new shared
    `components/deck/DeckMembershipPanel.vue` (the manual-deck checkbox
    list, extracted from `/cards`' pre-existing standalone "Decks" panel)
    is reused in two more places: `/cards`' row edit form and
    `CardPreviewModal`'s edit mode (feature 16) - both wired to the same
    already-loaded `manualDecks`/`membershipsData`/`toggleDeckMembership`
    state, no new fetches. `/cards`' original standalone "Decks"
    button/panel is untouched and still works exactly as before; this adds
    a second, complementary entry point rather than replacing it.
35. **Library search + infinite scroll** - done, three sub-features
    (per-page search/filter plus scroll-triggered loading, replacing feature
    19a's numbered pagination one list surface at a time):
    - **35a. Cards library search + infinite scroll** - done. A search box
      on `/cards` narrows the list by song/artist/anime title; its
      numbered `Pager` is replaced by "load more as you scroll."
    - **35b. Decks library search + infinite scroll** - done. The same two
      changes applied to `/decks`' top-level list, per active tab (Artist:
      artist name; Anime: EN/Romaji/Native title; Created: deck name).
      Switching tabs clears the search box and reloads that tab fresh.
    - **35c. Deck detail search + infinite scroll** - done. The same two
      changes applied to the card list inside a selected manual/artist/anime
      deck's detail view (matches song title, artist name, or anime title
      across all three deck types via the same `cardSearchCondition`
      `/api/cards` already used). The five existing card-list mutations on
      that view (remove/edit/download/add-existing/add-new-anime) were
      updated to mutate the loaded list in place or reload fresh instead of
      refetching, so an infinite-scrolled position survives them. `Pager.vue`
      was deleted once this landed - it had no remaining callers. A same-build
      fix also corrected a pre-existing crash on the By Title/Created tabs
      (`deckItems` referenced an undefined `data` ref instead of `rawDecks`)
      and a mobile-only bug where the new search input lost focus/closed the
      on-screen keyboard on every keystroke (it was inside the same
      pending-gated block its own results list was, so a debounced refetch
      unmounted it mid-type - fixed by hoisting the input above that gate,
      matching how 35a/35b's own search inputs are already positioned).
36. **Unify Preview's expand mode with Study's immersive overlay** - done.
    `CardPreviewModal`'s own separate expand mechanism (feature 20 - grew
    the whole modal panel, video and info stacked, scrollable) is replaced
    by passing `:allow-expand`/`v-model:immersive` into its existing
    `<StudyMediaPlayer>`, reusing feature 31's immersive/overlay mechanism
    (info card over the video, `E` hotkey) unchanged - no changes needed to
    `StudyMediaPlayer.vue` or `StudyInfoPanel.vue` themselves. No Pass/Fail
    overlay in Preview (no quiz/review state there); immersive is
    unavailable while editing a card (expand button hides, `E` no-ops).
    Escape's existing two-step behavior (collapse immersive, then close)
    carries over, with `CardPreviewModal`'s own Escape-to-close handler
    gated on `!immersive` so the two `window`-level handlers don't both
    fire the same keypress.
37. **Bulk artist import** - done, two sub-features. A "search by artist"
    mode (originally on `/cards/new`, alongside that page's anime search;
    ported to `/cards`' Artist add-candidate group by feature 49b and the
    page retired by 49c) that pulls
    in an artist's entire animethemes.moe catalog across every anime they
    have themes in, instead of one anime at a time.
    - **37a. Artist search + theme resolution** - done. Finds an artist on
      animethemes.moe by name (`artistPagination(search: ...)`) and walks
      `performances -> song -> animethemes -> anime -> resources(site:
      ANILIST)` to collect every anime that artist has themes in, resolving
      each via the existing `fetchAnimeFromAniList` +
      `upsertAnime`/`getOrCreateArtist`/`upsertSong` pipeline
      `/api/lookup/import` already uses for a single anime - looped across
      all of that artist's anime instead of one picked by the user. A "By
      anime"/"By artist" mode toggle on the then-current `/cards/new`
      gated a parallel
      artist-search form; selecting a candidate shows a read-only preview
      list of every song/theme found grouped by anime - no `Card` rows
      created yet. Only the artist's own direct `performances` are
      resolved (not `memberPerformances` - themes credited to a different
      group the artist is a member of); an anime an AniList round-trip
      fails for is skipped rather than aborting the whole import, and a
      theme with no linked AniList anime is silently skipped.
    - **37b. Bulk card creation + download** - done. Per-row "Add" (reusing
      the same `addCard()` the anime-search flow already uses, its
      parameter type widened to a small structural shape both flows
      satisfy) and an "Add all" that loops every theme across every anime
      group via `POST /api/cards`, skipping any song already added so a
      re-click after a partial add can't create duplicate cards. A
      "Download all" (shown once a default download folder is set) loops
      every added card with a not-yet-local video, downloading them
      **sequentially** via feature 8's existing per-card download
      machinery, reusing that machinery's existing per-row progress bar -
      video only, matching the original feature note's own scope; per-card
      audio download stays available individually. An artist-added card is
      otherwise identical everywhere else in the app (Preview, Delete,
      download) to one added via the anime-search flow.
38. **Auto-reveal timer for Hide Info** - done. On `/study`, when
    Hide Info (feature 10) is active, an optional persisted "Auto Reveal"
    toggle blurs each new card's info as usual but automatically reveals it
    after a short, visibly counting-down timer - re-arming on every new
    card (including after a pass/fail advances the queue), not a one-time
    reveal for the session. `/study`-only; not extended to
    `CardPreviewModal`, which has no Hide Info toggle to begin with. A
    same-day fix (2026-08-31) synced the countdown to actual playback: it
    previously started on the media element's `play` event, which fires as
    soon as playback is requested even while a remote (not-yet-downloaded)
    clip is still buffering, so the timer could burn through dead air
    before anything was audible/visible. It now starts on the `playing`
    event instead, which only fires once the browser is actually
    rendering frames/audio, on both `StudyMediaPlayer`'s `<video>` and
    `<audio>` elements.
39. **Search-by-song mode on Add card** - done, built ad hoc in chat
    (2026-08-31), not spec'd through `/feature`. A third "By song" toggle
    on the then-current `/cards/new`, alongside its "By anime" (feature
    3/4) and "By artist" (feature 37) modes, letting a card be found
    directly by song/theme title instead of going through an anime or
    artist first. Feature 49a ported this to `/cards`' Song
    add-candidate group and 49c retired the page; the server side below
    is unchanged and still backs it.
    `searchSongsOnAnimeThemes()` (`server/lib/animethemes.ts`) uses
    animethemes.moe's global `search { songs { ... } }` query;
    `GET /api/lookup/song-search` wraps it read-only, and
    `POST /api/lookup/song-import` lazily resolves one chosen result into
    real `Anime`/`Artist`/`Song` rows (reusing the same
    `upsertAnime`/`getOrCreateArtist`/`upsertSong` pipeline features 3/37a
    already use) only when the user clicks it, reporting back an existing
    card via feature 4's duplicate-prevention check instead of erroring.
    All three search modes were also unified onto one shared query field
    (previously each had its own, so switching tabs looked like it wiped
    what you'd typed even though each tab's own text was in fact
    preserved) - now the same typed text carries across all three tabs.
40. **"Cards left" counter on Study** - done, built ad hoc in chat
    (2026-08-31), not spec'd through `/feature`. `/study` shows a live
    count of due cards remaining in the active `StudyScope` (all / by
    artist / by anime) next to the existing "Card N this session"
    counter. `getDueCardCount()` (`server/utils/cards.ts`) shares its
    due/scope/daily-new-card-limit condition logic with the existing
    `getNextDueCard()` (factored into one `dueCardCondition()` helper so
    the two can't drift); `GET /api/study/next` now returns `dueCount`
    alongside the next card, so the count updates after every pass/fail
    with no extra requests. A failed card returns to box 1 with its
    0-day interval and stays immediately due, so the count holds steady
    while stuck on one card rather than decrementing - a deliberate
    choice, since "how many distinct cards still need a passing review"
    is the useful signal, not a raw review tally.
41. **Configurable local cache for streamed clips** - done. A size-capped
    local disk cache (`nuxt-app/.data/stream-cache/`, gitignored, keyed by a
    sha256 hash of the remote URL) for remote animethemes.moe video/audio
    clips played directly from the CDN (not local-file cards, which are
    already local). `GET /api/media/stream` proxies a remote URL through
    the cache with full byte-range support (scrubbing works exactly as for
    local files), fetching and saving on a miss and serving the cached copy
    on a hit; concurrent requests for the same uncached URL (a prefetch
    racing a real play) dedupe to one fetch. Caps total cache size at a
    configurable amount (`streamCacheMaxBytes` on `MediaLibrarySettings`,
    default 1GB, adjustable in Settings), evicting oldest-accessed-first
    (filesystem `atime`) once over budget - lowering the cap re-runs
    eviction immediately rather than waiting for the next write. Both the
    stream route and the prefetch route below host-allowlist their `url`
    param to `animethemes.moe` and its subdomains, so neither can be used
    as an open URL proxy. Also prefetches in the background via `POST
    /api/media/prefetch`: a card's own clip as soon as it loads (in Study
    or Preview), plus - in Study only, since Preview has no queue - the
    next 2 upcoming due cards, so clips are typically already cached by the
    time the queue actually reaches them. The lookahead is a best-effort
    snapshot, not a live prediction - a wrongly-guessed prefetch is
    harmless, just an occupied cache slot.
42. **Download fallback when playback fails** - done. When a card's
    video/audio clip fails to load during Study or Preview, `StudyMediaPlayer`'s
    error state shows a "Download video" / "Download audio" option (for
    whichever remote source exists and isn't already local), reusing the
    existing per-card download action (feature 8) instead of leaving a
    dead-end error message. A successful download's new local path flows
    back up through a `local-path-updated` event (translated, for Preview,
    into `CardPreviewModal`'s existing `updated` event) so the calling page
    patches its own card state - `/study`'s in-memory current card, or the
    same `updated` handler `/cards` and `/decks` already had
    for edits - and the error clears the instant the media source actually
    changes, no reload needed. A card whose failure is a broken *local*
    file (a path already set, but 404s or won't decode) is out of scope
    here - feature 8's download route refuses to download over an existing
    local path, so that case still needs the existing Clear-then-redownload
    flow (feature 27).
43. **Playback mode setting (Auto / Audio only)** - done. A persistent
    Settings-page default, not per-session or per-scope, that governs both
    what plays and what feature 41's cache fetches/stores. Auto (default)
    keeps today's behavior (video when available, else audio); Audio only
    forces every card to audio-only regardless of a local/remote video
    source, and stops the cache from prefetching or storing video going
    forward - trading video playback for lower local storage/bandwidth use.
    A third attempt at an idea tried twice before (see features 18 and 32) -
    resolves once, from an `await`ed fetch completed before a card's player
    ever mounts (`StudyMediaPlayer`'s `mediaKind`/`quizType`, plus
    `resolveRemotePrefetchUrl()` for both the current card and feature 41's
    2-card lookahead), and is editable only on `/settings` - never inline on
    `/study` - so nothing can change it reactively mid-playback, specifically
    to avoid feature 18's overlapping-audio rollback cause. Wired into both
    `/study` and Preview (`CardPreviewModal`, via `/cards` and `/decks`).
44. **Cover image for audio-mode cards, with a Hide Cover toggle** - done.
    For a card with no video actually playing this session - naturally
    audio-only, or forced there by feature 43's Audio Only setting -
    `StudyMediaPlayer` shows the anime's cover image (`animeCoverImageUrl`,
    already returned by `/api/study/next` but newly typed client-side) as a
    small spinning vinyl-record disk (dark disk with a groove texture and
    center spindle hole, the cover art as a circular "label" inset in it,
    rotating while playing and holding its angle when paused) rather than
    filling the whole frame, which an earlier iteration of the same step
    tried and revised away from as "stretched to fill everything." The
    ambient glow (feature 14) samples colors from that same image instead
    of turning off. A new session-only "Hide Cover" toggle (`c`, alongside
    Hide Video/Hide Info/Random Start/Ambient mode) can turn it off,
    defaulting to shown; a card whose anime has no cover image, or whose
    cover URL fails to load, always falls back to today's plain veil
    regardless of the toggle. `showCoverArt` gates on `mediaKind`
    (unaffected by Hide Video by design), not `quizType` - checking
    `quizType` would have wrongly let Hide Video suppress cover art on a
    card that never had video to hide. Deliberately does not touch the
    Hide Video toggle (feature 10) - hiding video on an otherwise
    video-capable card keeps today's exact plain veil, since real video is
    still playing underneath for its audio track in that case. Applies to
    `/study` (with the toggle) and `CardPreviewModal` (automatically,
    no toggle - Preview has no display-toggles row).
45. **Audio visualizer overlay on the spinning record** - done. A soft,
    glowing ring just outside the record disk's edge, driven by a Web Audio
    API `AnalyserNode` wired to the existing `<audio>` element
    (`getByteFrequencyData()` read every animation frame, smoothed with a
    circular moving average so real audio energy - concentrated in a few
    low bins - reads as one continuous deforming loop rather than a mostly-
    empty bar chart). The ring is filled by stamping the actual cover-art
    image into its stroked shape (`globalCompositeOperation: "source-in"`,
    revised away from an earlier flat-accent-color and a color-sampling
    design - sampling needs a second CORS-mode image load animethemes/
    AniList don't reliably grant) and then heavily CSS-blurred, so it reads
    as "glowing with the cover's color" without showing recognizable image
    detail. Shown exactly when `showCoverArt && isPlaying`; stays fully
    inside the player frame at every size, including expanded/immersive
    mode. Also added, as a same-build follow-on once the ring itself was
    approved: a mouse-driven 3D parallax tilt on the record (up to ±10°
    toward the cursor) with the visualizer ring counter-shifting a smaller
    amount the other way, both easing back to neutral on mouse-leave -
    gated on `showCoverArt`, no effect on video-mode cards. No dedicated
    toggle - tied to `showCoverArt`/Hide Cover exactly like the record
    itself. Applies wherever feature 44's cover art applies (`/study` and
    `CardPreviewModal`), automatically.
46. **Auto Reveal modes + settings popup** - done. Replaces the single
    Auto Reveal on/off toggle (feature 38) with a mode choice - Video,
    Info, or Both - moved into a small settings popup (`StudyAutoRevealSettingsModal.vue`,
    opened from a single "Auto Reveal" button) alongside the countdown
    interval, instead of extra buttons crowding the display-toggles row.
    "Video" targets whichever visual actually applies to the current card -
    Hide Video on a video-capable card, or Hide Cover (feature 44) on an
    audio-only/cover-art one - since those two already share one slot as
    far as auto-reveal is concerned. Turning on a mode (or switching modes)
    forces its target Hide toggle(s) on immediately, and again at the start
    of every new card, overriding any manual Hide Video/Hide Info/Hide
    Cover change made mid-card; switching mode or turning Auto Reveal off
    reverts whichever toggle(s) it had forced back off, without touching a
    toggle neither the old nor new mode ever targeted. Several same-day
    fixes on top of the initial redesign: Auto Reveal no longer requires
    Hide Info to be on at all (previously gated behind it, so turning on
    Auto Reveal alone did nothing without also manually enabling Hide
    Info/Video/Cover); the countdown now pauses and resumes with actual
    playback instead of a fire-and-forget wall-clock timer that could
    reveal the answer while paused; manually revealing a still-targeted
    toggle early now stops the pending timer instead of leaving it ticking
    uselessly; changing the mode or interval after a card has already
    revealed no longer re-hides that same card (the new setting applies
    starting cleanly on the next one); and the countdown pill, which
    previously never appeared at all in immersive mode (an unrelated
    `v-if`-vs-`visibility` DOM bug collapsed its container to 0x0), now
    shows dead-centered over the player, replacing the "Listening.../
    Paused" text entirely while it counts down, and scales up proportionally
    with the expanded frame instead of staying pinned at its small
    non-immersive size.
47. **Artist search + categorized results in global search** - done. Adds
    two new live-search categories to the nav bar's search dropdown
    (`NavBar.vue`) alongside today's local `Cards` group (feature 19b/26,
    untouched): an `Artists` group backed by the existing `GET
    /api/lookup/artist-search` (animethemes.moe - the same endpoint
    `/cards`' Artist add-candidate group uses) and an `Anime` group,
    which is the "Add a show" AniList fallback (feature 26) relabeled
    and always shown rather than gated behind the `Cards` group being
    empty. Both groups originally deep-linked into `/cards/new`
    (`?artistSlug=<slug>` and `?aniListId=<id>`), auto-resolving the
    catalog or theme list on arrival with no second click. Feature 49c
    retired that page, so both now navigate to `/cards?q=<name or title>`
    instead: the same result re-surfaces in `/cards`' own Artist or Anime
    group, one click from the same action. That extra click is a
    deliberate trade recorded in 49c's spec - auto-opening the Artist
    modal on arrival would cover the local/Anime/Song groups behind an
    overlay, working against the unification feature 49 exists to
    deliver.
48. **Standalone platform-agnostic packaging** - done, in three
    sub-features. A self-contained executable per OS/arch (Windows,
    macOS x64/arm64, Linux) built via `bun build --compile` (`bun run
    package`, `nuxt-app/scripts/package.ts`), bundling the Nitro server
    and opening the user's default browser on launch, so the app runs
    without a separate Node/Bun/Nuxt install. Relocates the SQLite DB
    (`nuxt-app/.data/gaq-srs.db`) and `MediaLibrarySettings` (library
    paths, default download folder, stream cache) to an OS-appropriate
    user-data directory, since a packaged executable can't rely on a
    project-relative `.data/` path the way the developer workflow does.
    `better-sqlite3` is a native addon, so this is a build/release matrix
    (one binary per OS/arch), not a single universal download. Revisits
    the idea previously scoped as feature 25 ("Standalone desktop
    packaging"), abandoned 2026-08-30 before any code was written; 48 is a
    new feature, not a reuse of that retired number.
    - **48a. User-data-directory storage relocation** - done. An optional
      `GAQ_SRS_DATA_DIR` env var overrides the project-relative
      `.data/gaq-srs.db` default (`server/db/dataDir.ts`);
      `MediaLibrarySettings` relocates automatically with it since it
      lives in the same DB.
    - **48b. Launcher entrypoint + single-platform compile proof** -
      done. `nuxt-app/launcher/index.ts` computes the OS-appropriate
      user-data directory, sets `GAQ_SRS_DATA_DIR`, starts the built
      Nitro server, and opens the default browser once it's listening.
    - **48c. Full OS/arch build matrix** - done. Extends 48b's compile
      step to every target with `nuxt-app/scripts/package.ts` and a
      documented release process; code-signing/notarization is out of
      scope, so unsigned binaries show an OS security warning on first
      run.

    Several fixes landed on top of 48c once real packaged-binary testing
    started (2026-09-02): kuromoji/furigana failed to load inside a
    compiled binary (kuromoji's own `require()` chain can't resolve from
    inside one - fixed by shipping a pre-bundled, dependency-flattened
    copy alongside the real `dict/` folder); the launcher's
    compiled-binary detection missed Windows' `~BUN`-prefixed virtual
    path (`import.meta.url` resolves to a `<drive>:\~BUN\...` path there,
    not the macOS/Linux `/$bunfs/...` one); having exactly one library
    folder configured never actually persisted it as the default download
    folder, silently hiding `/cards`' download buttons - not
    packaging-specific (reproduced under `bun run dev` too), just first
    noticed via Windows testing (archived at
    `blueprint/history/fixes/default-download-folder-single-library.md`);
    and AniList lookups returned a bare 403 in the packaged Windows build
    because `anilist.ts` sent no `User-Agent` header, fixed the same way
    animethemes.moe already required one (see feature 3's entry). A
    further addition seeds a "themes" folder next to the database as the
    default library folder on first boot when none is configured yet, so
    a fresh install can download a card immediately without a trip to
    `/settings` first.
49. **Unify card search with Add Card** - done, in three sub-features.
    `/cards`' own search (feature 35a, already matching
    song/artist/anime-title) is now the one surface for finding an
    existing card or adding a new one, replacing the standalone
    `/cards/new` page (deleted) and repointing NavBar's global search
    dropdown at it. Local matches are always shown first; Anime, Song,
    and Artist add-candidates run in parallel alongside them (ordering
    only, not gated on local results being empty - keeps feature 47's
    already-parallel approach rather than reintroducing the gated
    behavior feature 47 deliberately moved away from). Each group is its
    own component under `components/card/` (`CardAddAnimeResults`,
    `CardAddSongResults`, `CardAddArtistResults`), taking the same
    `query`/`has-default-download-folder` props and emitting the same
    `refresh`/`preview` events, with independent loading/error/empty
    states so a slow or failed AniList lookup can't block the other
    groups or the local list. No server route was added, removed, or
    changed by any of the three sub-features - every endpoint
    `/cards/new` called is still in use, now from these components.
    Built additively in phases: `/cards/new` and every entry point to it
    stayed untouched until the new surface was proven, then a final
    sub-feature retired the page and rewired callers.
    - **49a. Anime + Song add-candidates on /cards** - done. Extends
      `/cards`' existing debounced search to also run the AniList anime
      lookup and the animethemes song lookup in parallel with the local
      list fetch, at the same 2-character minimum NavBar uses, rendered
      as two groups below local matches. Anime results expand inline (no
      navigation, no modal) into a theme-picker via `POST
      /api/lookup/import`, with each theme getting a local-video-path
      input and an "Add" button (`POST /api/cards`). Song results add in
      one click (`/api/lookup/song-search` + `/api/lookup/song-import`,
      which returns an `existingCard` instead of erroring when one
      already exists). Both groups pre-mark already-added themes via
      `GET /api/cards/by-songs` before any Add button renders, and a
      successful add refreshes the local list while flipping the result
      row to an "Added" state rather than removing it.
    - **49b. Artist add-candidates + bulk preview modal** - done. Adds
      the third group, backed by `GET /api/lookup/artist-search`;
      picking a result resolves the artist's full catalog (`POST
      /api/lookup/artist-import`, which returns `{ artistName,
      animeGroups }` already grouped by anime) into a modal - a new
      interaction shape for `/cards`, since Anime and Song both expand
      inline - generalizing the `DeckAddAnimeModal` pattern from feature
      33 for an artist's multiple anime and not deck-scoped. Per-theme
      "Add", "Add all", and a sequential "Download all", the same bulk
      actions feature 37b gave `/cards/new`'s artist mode. No
      local-video-path input, matching that mode.
    - **49c. Retire /cards/new** - done. Deleted the page and rewired
      its seven entry points (the build-plan line says six; grep
      confirmed seven) - NavBar's three query-param navigations, and the
      empty-state links on `/cards`, `/stats`, and `/decks` - to the
      unified `/cards` search. `/cards` gained one optional `?q=` param
      that seeds its search, replacing the three retired `/cards/new`
      params (`?q=`, `?aniListId=`, `?artistSlug=`); it is read both on
      mount and via a `watch`, since NavBar sits on every page and a
      search submitted while already on `/cards` navigates
      `/cards` -> `/cards?q=X` without remounting. No redirect from
      `/cards/new` was added - the route 404s, deliberately, for a local
      single-user app with no external inbound links. The deck-detail
      add flow (features 28/33) never touched `/cards/new` and is
      unaffected, despite the parent feature's text listing it as an
      entry point being replaced. A same-day follow-on then removed
      `/cards`' "Add card" header button, which 49c had left in place as
      a button that only focused the search input directly below it.

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
- `streamCacheMaxBytes` (integer, not null, default `1073741824` = 1GB) -
  added in feature 41. Caps the local disk cache
  (`nuxt-app/.data/stream-cache/`) of remote animethemes.moe clips; lowering
  it re-runs eviction immediately.
- `playbackMode` (text, not null, default `"auto"`, values `"auto" |
  "audioOnly"`) - added in feature 43. Editable only on `/settings`; see
  feature 43's entry above for why.

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

### Study scope playback preference (abandoned, feature 18)

Built as a `studyScopeSetting` table (one row per study scope, plus a
`forcedMode` prop threaded into `StudyMediaPlayer`), then rolled back
2026-08-29 - the table was dropped from the live database and its
migration removed, so it is **not** part of the current schema. Abandoned
outright the same day rather than queued for a redesign: it is not a
build-plan target and its number (18) is retired, not reused. Full detail
lives in
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
query-string parameters (`/decks`' `?type=&id=`, `/cards`' `?q=`) or a
body-carried `id` for mutations, and that convention should continue rather
than mixing in a new one. A page reading a query param should handle both
first mount and a later same-route navigation (a `watch`, not just
`onMounted`), since the nav bar is on every page and can navigate a page to
itself with new params without remounting it.

Routes:

- `/` - done (feature 15). A launcher hub with links to Study, Cards, Decks,
  Stats, Settings - no live data, no dashboard stats. Ships alongside a
  persistent top nav bar in a shared Nuxt layout, present on every page.
- `/settings` - done. Media library folder configuration, plus (feature 8) a
  default download folder picker shown once 2+ folders are configured, plus
  (feature 9) an "Import deck" form (source path -> created/skipped summary
  or per-entry errors) - this is where feature 9 resolved its own
  then-undecided placement question. Feature 41 added a stream-cache size
  control (MB input, default 1024) for the local disk cache of remote
  animethemes.moe clips. Feature 43 added a Playback mode control (Auto /
  Audio only) - the only place this setting can be changed, deliberately
  not exposed on `/study` itself.
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
  confirmation step. Feature 35a replaced numbered pagination with a search
  box (song/artist/anime title) plus scroll-triggered "load more." Feature
  49 extended that same search box into the app's one add-a-card surface:
  Anime, Song, and Artist add-candidate groups render below the local
  matches and run in parallel with them, folding in the whole capability
  of the now-deleted `/cards/new` page - see feature 49's entry above. It
  accepts one optional `?q=` param that seeds the search (49c), the only
  route param in the app besides `/decks`' existing `?type=&id=`.
  `/cards` has no separate "Add card" button: the search box itself is
  the add affordance, advertised by the hint line under the heading and
  by the empty state.
- `/decks` - done. Artist and Anime-Title deck groupings, list + detail, plus
  (feature 9) a per-deck export control and (feature 12) anime cover
  thumbnails on anime-type decks. Feature 13a added a third "Created" toggle
  for manual decks - create/rename/delete inline, real card counts and card
  list once 13b landed, with a per-card "Remove" action found only in the
  manual-deck detail view. Neither "Study this deck" nor the export block
  appears there. Feature 22 added a per-row "Preview" button to the detail
  card list (all three deck types), reusing `CardPreviewModal` unchanged.
  Feature 35b replaced the top-level list's numbered pagination with a
  per-tab search box plus scroll-triggered "load more"; feature 35c did the
  same for the detail card list inside a selected deck, and switched its
  five existing mutations (remove/edit/download/add-existing/add-new-anime)
  from refetching the current page to updating the loaded list in place (or
  reloading fresh for the two "add a card" flows), since infinite scroll has
  no single "current page" to refetch.
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
  Feature 38 added the persisted Auto Reveal timer for Hide Info. Feature
  40 added a live "N cards left" counter for the active study scope next
  to the existing "Card N this session" counter. Feature 42 added a
  "Download video"/"Download audio" fallback action directly on the error
  state shown when a clip fails to load, reusing feature 8's per-card
  download action; `CardPreviewModal` (which reuses the same
  `StudyMediaPlayer`) gets this too. Feature 44 added the cover-image
  spinning record (plus its `c`/"Hide Cover" toggle) for any card with no
  video actually playing, and a same-build fix made `.player-frame` itself
  transparent under ambient mode so the glow shows through the space
  around the record (or a video's letterbox bars), not just outside the
  frame. Feature 45 added the glowing, cover-colored audio visualizer ring
  around that record plus a mouse-driven parallax tilt, both automatic
  whenever the record shows. Feature 46 replaced Auto Reveal's on/off
  toggle with a Video/Info/Both mode choice in its own settings popup,
  with several same-build fixes (decoupled from Hide Info, pausable with
  playback, stops on an early manual reveal, doesn't re-hide an
  already-revealed card, and - fixed after initial release - the countdown
  now actually renders in immersive mode, dead-centered and scaled to the
  frame, instead of never appearing there at all).
- `/stats` - done. Overall pass rate plus a By Artist / By Title toggle,
  each row's guess rate. Feature 29 added a manual "Refresh" button and a
  destructive "Clear history" action (two-step inline confirm) that wipes
  `ReviewLog` only - `Card.box`/`Card.nextReviewAt` are untouched.

## Deployment

Localhost-only - no remote hosting, no accounts, no multi-device sync. Two
ways to run it: the developer workflow, and (feature 48, done) a packaged
standalone executable.

- **App type**: Nuxt server (Nitro), run on the user's own machine
- **Build**: `bun run build` (see Commands in `AGENTS.md`)
- **Run**: `bun run preview` (production) or `bun run dev` (development) for
  the developer workflow; a per-OS/arch compiled executable
  (`nuxt-app/release/<target>/gaq-srs[.exe]`, built via `bun run package`)
  for the packaged build
- **Storage**: SQLite database at `nuxt-app/.data/gaq-srs.db` for the
  developer workflow (resolved in feature 1; gitignored, created and
  migrated automatically on first boot), or an OS-appropriate user-data
  directory for the packaged executable (feature 48a) - `%APPDATA%\gaq-srs`
  on Windows, `~/Library/Application Support/gaq-srs` on macOS,
  `~/.local/share/gaq-srs` on Linux (`GAQ_SRS_DATA_DIR`, overridable by
  hand in the developer workflow too) - since that build can't rely on a
  project-relative path. `MediaLibrarySettings` lives in that same DB and
  relocates with it. Either way, a "themes" folder is seeded next to the
  database as the default media library folder on first boot when none is
  configured yet.
- **Env vars**: `GAQ_SRS_DATA_DIR` (optional; packaged builds set it
  automatically)
- **Packaged build**: feature 48, done - a self-contained executable per
  OS/arch (Windows, macOS x64/arm64, Linux) built via `bun run package`
  (`nuxt-app/scripts/package.ts`), since `better-sqlite3`'s native addon
  rules out one universal binary. Unsigned - macOS Gatekeeper/Windows
  SmartScreen show a security warning on first run. Revisits the idea
  previously scoped as the now-retired feature 25, abandoned 2026-08-30
  before any code was written.
- **Health check / domain**: not applicable (local-only)

## Notes

`nuxt-module/` was scaffolded during initial setup as a possible reusable
module, then removed once the plan confirmed this is a single local app.
`nuxt-app/` is the only package.
