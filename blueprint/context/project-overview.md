# GAQ SRS - Project Overview

<!-- blueprint:source-hash 4d600f26d39a1cfb657a45d5da997e3928119ebf5257e30c1507926b2fb9ffab -->

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
the search box directly below it. Feature 55 (bulk add-all + download-all
parity for the Anime add-candidate group, matching what 49b already gave
the Artist group, plus extending both groups' bulk download to cover
audio as well as video) was added to `build-plan.md` on 2026-09-04 and is
now built and merged. Feature 50 (the Akiba Neon visual
redesign, in eight sub-features 50a-50h) was added to `build-plan.md` on
2026-09-02 and is now built and merged in full - a retheme and relayout
only, changing no data model, route, or server behavior. Adding it also
rewrote `project-plan.md`'s UI/UX section (§7), which had described the app
as "cute/moe, a little cartoony" with "rounded corners throughout" - feature
50 deliberately reverses both, and the app now matches §7 as written. Two
decisions were resolved mid-build and are recorded on the affected
sub-features rather than here: 50b kept 50a's rail on `/study` rather than
going rail-less, and 50c restyled feature 49's unified `/cards` search
instead of reinstating a separate Add-card page. One decision from the
original note was open and outside any single sub-feature: which of
the mockup's `1b`/`2a`/`2b` Study fullscreen/ambient-overlay candidates, if
any, should replace or complement feature 31's immersive mode -
none of 50a-50h touched it. Feature 53 answered it with `#2b`, was built,
then rolled back, after which `/study` lost immersive mode altogether, so
the question is now moot rather than resolved: there is no `/study`
overlay left to replace. Features 51 and 52 (previous-card
navigation and a study session log) were added to `build-plan.md` on
2026-09-03 and are now both built and merged; neither changed
`project-plan.md`, since both are additions to the existing Study screen in
the same session-only style as the Hide Video/Hide Info toggles (feature
10). Feature 53 (an immersive-mode redesign) was added to `build-plan.md`
the same day, resolving that still-open overlay decision by picking the
`#2b` "Bottom bar" candidate - reskinned to the app's shipped Akiba Neon
tokens rather than that candidate's own Nocturne tokens. It was built and
merged, then rolled back the same day, and a follow-on fix then removed
`/study`'s immersive mode entirely. It was abandoned outright 2026-09-18 -
not a build target, and its number is retired, not reused, joining
18/25/32. Feature 54 (a
version stamp plus a GitHub release check) was added and built on
2026-09-04, and is the point at which the project gained a unit test runner:
Vitest was installed the same day, so the logic-test gate in
`coding-standards.md` is now on rather than opt-in. Feature 55 (bulk
add-all + download-all parity for the Anime add-candidate group, and
extending both groups' bulk download to cover audio as well as video) was
added and built the same day. Feature 56 (free-text per-card notes,
Migaku-style, editable from every existing card-edit surface and shown in
`StudyInfoPanel` during Study and Preview) was also added and built
2026-09-04. Feature 57 (an ultrawide/large-screen layout cap) was added to
`build-plan.md` the same day after Study's aspect-locked video pane and
fixed-width info column were found to grow into unbounded dead space past
roughly 2560px of viewport width; it caps and centers the app's main
content column above that width, leaving every screen's existing
full-bleed look unchanged below it, and amended `project-plan.md` §7's
App layout bullet to record the exception. Feature 58 (importing a user's
public AniList/MyAnimeList Completed list as browsable anime add-candidates)
was added to `build-plan.md` on 2026-09-05 and is now built and merged; it
added a new §3 Features bullet and a §5 Tech line to `project-plan.md`. That
Tech line named Jikan, the unofficial no-key MyAnimeList wrapper it was built
on, and was rewritten on 2026-09-13 to name MyAnimeList's own public list
endpoint instead, after the `mal-list-direct-lookup` fix (2026-09-12)
dropped Jikan: MAL had begun refusing its scrape with a permanent `504`. See
feature 58's entry below. Feature 59 (a persistent Auto Download
setting) was added to `build-plan.md` on 2026-09-12 and is now built and
merged; it did not change `project-plan.md`, the same way feature 43's
Playback mode setting did not. Feature 60 (AnisongDB as the preferred OP/ED
metadata and clip-URL source, in three sub-features 60a-60c) was added to
`build-plan.md` on 2026-09-13 and is now built and merged in full. It amended
`project-plan.md`'s §3 "Anime & song lookup" bullet and added a §5 Tech line,
since it introduces a new external provider that outranks animethemes.moe
rather than merely extending it. Feature 61 (card deletion and bulk delete,
in three sub-features 61a-61c) was added to `build-plan.md` on 2026-09-13
and is now built and merged in full; it amended `project-plan.md`'s §3
"Flashcard CRUD" bullet. Feature 62 (a cute/moe soft retheme, in two
sub-features 62a-62b) was added to `build-plan.md` on 2026-09-14 and is now
built and merged in full. It replaces feature 50's Akiba Neon
look with a gruvbox-inspired soft dark palette (rose and light sky blue
accents), playful handwritten Japanese-capable fonts, and rounder corners, and
rewrote the first two bullets of `project-plan.md` §7 to put cute/moe ahead
of the Akihabara arcade style. Feature 63 (Temi, the app's mascot) was added
to `build-plan.md` on 2026-09-14 and is now built and merged; it added a §7 UI/UX
bullet to `project-plan.md`, reversing 62's "no mascots" scope note for
non-working surfaces only. Feature 64 (a Clip source setting, in three
sub-features 64a-64c) was added to `build-plan.md` on 2026-09-14 and is
built in full. It revises feature 60's "no new setting" decision, and amended
`project-plan.md`'s §3 "Anime & song lookup" bullet and §5 AnisongDB Tech
line. Feature 65 (typed anime answers on Study, with automatic grading, a
result/continue phase, and session score/combo) was added to `build-plan.md`
on 2026-09-15 and is now built and merged in full; it added a §7 UI/UX
bullet to `project-plan.md`. This paragraph did not record it at the time -
noted here retroactively, the same way 39/40's gap was recorded. Feature 66
(multi-category typed answers, in two sub-features 66a-66b) was added to
`build-plan.md` on 2026-09-19, extending feature 65 with an optional
sub-menu of additional guessable categories beyond the anime title (Song
name, Opening/Ending number), each scored as independent bonus points on
top of the existing anime-guess score/combo; only the anime-name result
still drives SRS scheduling. No `project-plan.md` change - it extends
feature 65's already-documented Study capability rather than a new product
direction. Feature 67 (dynamic, arcade-style scoring feedback on Study - a
travelling "+N" burst, a counting-up score chip, escalating combo emphasis,
and staggered bonus rows) was added to `build-plan.md` on 2026-09-19 and is
built and merged. It is presentation only, changing no point value,
grade, schedule, or stored shape, and needed no `project-plan.md` change for
the same reason feature 66 did not. Feature 68 (a deeper `/stats`, in four
sub-features 68a-68d) was added to `build-plan.md` the same day; it reads
only data already stored - `ReviewLog`'s `boxBefore`/`boxAfter` and the
clock time of `reviewedAt`, plus `Card`'s `box`/`streak`/`nextReviewAt` - so
it needs no migration and no `project-plan.md` change, §3's existing
"Review stats" bullet already covering the surface it deepens. Sub-feature
68a (collection health + review forecast) is built and merged; 68b-68d are
not yet built. Feature 69 (a GitHub-contribution-style study activity
heatmap on the Home dashboard) was added to `build-plan.md` and built the
same day, 2026-09-20; it is purely additive next to feature 50f's existing
"Last 30 days" panel, reads the same `ReviewLog.reviewedAt` data via the
same local-date grouping `server/utils/stats.ts` already uses, and needs no
schema change and no `project-plan.md` change for the same reason feature
68 did not. A same-day revision, made mid-build before the feature was
marked complete, defaults the panel to a single-month calendar highlight
(`app/utils/monthHeatmap.ts`, reusing the same fetched data with no extra
API call) rather than opening on the full 53-week grid, with a Month/Year
toggle - matching the `tab-seg` convention `/decks` and `/stats` already
use - to switch to the unchanged year view. Feature 70 (filtering cards
without an AnimeThemes.moe match, in two sub-features 70a-70b) was added to
`build-plan.md` on 2026-09-20; neither sub-feature is built yet. It reads
`Song.animethemesThemeId`, which `resolveThemes()` (`server/utils/
themeSource.ts`) already sets to `null` exactly when a theme was resolved
via AnisongDB alone (no AnimeThemes.moe counterpart) - true across every
import path (anime, song, and artist import all hit the same "anisongdb"
branch) - so it needs no schema change and no new provider calls. It does
not touch Clip source (feature 64), which governs playback host only; this
is purely about which cards are visible/selectable in the library. No
`project-plan.md` change - it deepens §3's existing "Flashcard CRUD" bullet
rather than a new product direction, the same call feature 64 made. Feature 71
(per-deck grading criteria, in three sub-features 71a-71c) was added to
`build-plan.md` on 2026-09-22; 71a is built and merged, 71b-71c are not yet built. It is the first change to
the scheduling model since feature 6a locked it: Leitner state becomes keyed by
`(card, criterion)` rather than by card alone, so a manual deck can be drilled
for song names without its passes moving the same card's anime-title schedule
in another deck. Unlike features 66-70 it did amend `project-plan.md` (§3's
Decks and Study session bullets, three §4 Data bullets), since a deck-level
configuration and a second scheduling dimension are a product direction rather
than a deepening of a documented one.

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
      the export block, which still only covers artist/anime. It also hid
      "Study this deck" until the `study-manual-deck` fix (2026-09-14)
      added `{ type: "created"; id }` to `StudyScope`, so a created deck
      can be studied on its own.
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

    **No longer on `/study` as of 2026-09-03.** After feature 53's rollback,
    a follow-on fix (`remove-study-immersive-mode`) dropped the `E` hotkey
    and expand button from `/study` entirely; the page now passes
    `:immersive="false"` and does not pass `allow-expand`. The mechanism
    itself still lives in `StudyMediaPlayer.vue` and is still used by
    `CardPreviewModal` (feature 36), reached from `/cards` and `/decks`,
    so immersive mode is a Preview-only capability now. Everything above
    describes what `/study` did between features 31 and that removal.
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
50. **Visual redesign (Akiba Neon)** - done, in eight sub-features. Moved
    the app off its centered single-column layout to a persistent left rail
    plus split panes, and rethemed from the earlier purple/rounded look to
    blue-black + sakura + cyan with tight radii. Design reference:
    `blueprint/reference/design_handoff_anisong_srs_redesign/`
    (`Redesign.dc.html`, `Current UI.dc.html`, and `README.md`) - replaced the
    original single-canvas decode, `akiba-neon-canvas.html` (removed
    2026-09-03), which that folder fully superseded. Direction 1A was chosen
    for the overall app shell over the alternative 1B "Jukebox" take.

    Token deltas actually shipped (old -> new): `--bg` `#150f1c` ->
    `#07070d`, `--surface` `#1f1729` -> `#12121f`, `--border` `#392c4a` ->
    `#23233c`, `--accent` `#ff5da2` -> `#ff3e88`, `--accent-secondary`
    `#b18cff` -> `#34e7e4`, `--pass` `#7ee2b8` -> `#46e39b`, `--fail`
    `#ff6b6b` -> `#ff5470`, `--radius`/`--radius-sm` 18px/10px -> 4px/6px,
    `--font-sans` M PLUS Rounded 1c -> RocknRoll One + Zen Kaku Gothic New.
    Feature 14's ambient video glow was unaffected - it just glows cyan now
    instead of purple.
    - **50a. Theme tokens + app shell** - done. Ported the palette, type
      and radii into `main.css` and built the rail nav plus shared chrome.
    - **50b. Study screen** - done. Kept today's player + side info panel
      (1A) and collapsed the display-toggle row into one icon strip, so
      features 10/44/46's toggles changed presentation, not behavior.
      Resolved decision: kept 50a's rail on `/study` (the mockup's own
      artboard is rail-less) rather than adding a layout escape hatch;
      immersive mode (feature 31, `E`) was the distraction-free surface at
      the time. That reasoning no longer holds: `/study` lost immersive
      mode on 2026-09-03 (see feature 31's entry), so the rail is now the
      only Study layout and there is no rail-less escape hatch.
    - **50c. Cards** - done. Dense table + 400px inspector rail, row
      actions demoted out of every row. Resolved decision: restyled feature
      49's unified `/cards` search into the split-pane shape instead of
      reinstating the mockup's standalone Add-card page (Anime/Artist/Song
      tabs) - that architecture is exactly what feature 49 deleted.
    - **50d. Decks** - done. 6-column poster grid, covers carrying the
      layout instead of the earlier 640px list; applies to the top-level
      grid and a selected deck's detail view.
    - **50e. Stats** - done. KPI tiles plus a real reviews/pass-rate chart
      and by-artist/by-title breakdown with progress bars.
    - **50f. Home** - done. Dashboard replacing feature 15's five link
      cards: global search + Add-card shortcut, a due-cards hero, a 30-day
      activity card, and weakest-decks + recently-added panels, all on real
      data.
    - **50g. Settings** - done. Page-local section rail (Media library,
      Study pacing, Playback, Cache, Import & export) plus a content pane,
      matching 50d/50e's panel styling. Dropped the mockup's "Appearance"
      section - feature 24 already rejected a standalone theme toggle.
    - **50h. Narrow-window pass** - done. Extended the existing 820px
      breakpoint so every 50a-50g screen collapses the rail to icons,
      stacks split panes into one column, and drops the Cards table's
      lower-priority columns.

    One decision from the original scope note - which of the mockup's
    `1b`/`2a`/`2b` Study fullscreen/ambient-overlay candidates, if any,
    should replace or complement feature 31's immersive mode - was
    left unresolved by 50a-50h. Feature 53 below picked `#2b`, then was
    rolled back and `/study`'s immersive mode removed, so the decision is
    moot rather than resolved.
51. **Previous card navigation in Study** - done. Lets you step
    back to the single most recently reviewed card in the current session
    and review it again, view-only - does not re-submit a review or change
    that card's Leitner box/interval - via a "Previous" button + `P`
    hotkey that opens it in the existing `CardPreviewModal` (features
    11/16/36), pausing the live `StudyMediaPlayer` first so its audio can
    never overlap with Preview's (the failure class that got features
    18/32 abandoned). Builds a client-side `sessionHistory` list in
    `study/index.vue` - `SessionHistoryEntry { card: CardWithDetails;
    result: "pass" | "fail" }` - that resets on scope change and is
    load-bearing for feature 52. Today's forward-only due-card queue
    (`useStudySession`'s `fetchNext()`/Leitner scheduling, feature 6a) is
    unaffected. `ArrowLeft`/`ArrowRight` stayed bound to Fail/Pass, so this
    used a different hotkey. A same-build fix added a `--z-above-immersive`
    (70) token so the Preview modal renders above, not behind, the
    immersive layer (`--z-immersive`, 60).
52. **Study session log** - done. A small popup
    (`StudySessionLogModal.vue`, trigger button + `L` hotkey in the study
    header, always visible) listing every `sessionHistory` entry (feature
    51) newest-first - song/artist/anime title, Pass/Fail chip - distinct
    from feature 7's `/stats` (all-time, aggregate guess-rate tracking).
    Clicking a row opens that card in `CardPreviewModal`, paused, same as
    feature 51's "Previous" - both now share one `openHistoryCard(entry)` /
    `viewedHistoryEntry` mechanism and both render at `--z-above-immersive`.
    A correctness fix landed alongside it: neither overlay previously
    blocked the live `ArrowLeft`/`ArrowRight` Pass/Fail hotkeys, so
    answering while one was open silently reviewed the live card behind it
    - both now disable `StudyAnswerControls` via its existing `disabled`
    prop while open.
~~53. **Immersive study mode: bottom bar layout**~~ - abandoned
    2026-09-18. Built, then rolled back
    2026-09-03 (see
    `blueprint/history/rollbacks/2026-09-03-53-immersive-study-bottom-bar.md`).
    A follow-on commit then removed the expand/immersive mode from `/study`
    specifically (`CardPreviewModal` keeps its own, reached from `/cards`
    and `/decks`), so the `/study` overlay this feature existed to replace
    is gone and the feature's premise no longer holds there. Dropped from
    the roadmap entirely rather than redesigned a third time; not a build
    target, and its number is retired, not reused, joining 18/25/32. Added to
    `build-plan.md` on 2026-09-03, resolving the open decision noted under
    feature 50 above. Replaced feature 31's then-current immersive overlay (card
    info floated directly on top of the video) with the `#2b` "Bottom bar"
    candidate from
    `blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`:
    the video stays completely clean while playing, and everything -
    scrubber, volume, language toggles, title/song/artist/theme info, and
    Fail/Pass - moves into a horizontal bar underneath it instead.
    Reskinned to the app's shipped Akiba Neon tokens (`main.css`), not that
    mockup candidate's own Nocturne tokens (`--color-bg`/`--color-accent`
    purple mono-accent, Inter font, 8px radius) - a deliberate choice so the
    app doesn't carry two design systems, mirroring how feature 50c chose
    to restyle feature 49's real architecture over reinstating the
    mockup's own. It applied everywhere feature 31's immersive mode then
    applied: `/study` (video + bar, including Fail/Pass and feature 51's
    "Previous" button) and `CardPreviewModal` (info only, no review
    controls). It also updated `project-plan.md` §7 at the time; that
    section has since been rewritten again to record that `/study` has no
    immersive mode at all.
54. **Update checker** - done. Added to `build-plan.md` and built on
    2026-09-04. Nothing in the app carried a version before it -
    `nuxt-app/package.json` had no `version` field - so it added one
    (`1.2.0` then, `1.3.0` as of the feature-57 release; always matching the
    published release), read at build time into
    `runtimeConfig.public.appVersion` in `nuxt.config.ts` so a compiled
    binary, which has no `package.json` beside it, still knows what it is.
    `GET /api/version` (`server/api/version.get.ts`, backed by
    `server/utils/version.ts`) checks the public `wiredPuru/Anisong-SRS`
    GitHub releases API for a
    newer tag and surfaces an "update available" notice linking to the
    release page: a new Settings "About" section (rendered outside the
    settings fetch, so the version stays readable when settings fail to
    load) and a dot on the rail's Settings link, shared through
    `app/composables/useUpdateCheck.ts` so both read one fetch. Only the
    remote lookup is cached (6h on success, 10min on failure), with
    `updateAvailable` recomputed per call so a cached result cannot outlive
    the version it was compared against.
    Notify only: it never downloads or replaces the running
    binary, because a build is an executable plus three sibling folders
    (`migrations/`, `public/`, `kuromoji/`), Windows cannot overwrite a
    running `.exe`, and macOS needs re-signing after any binary swap (see
    feature 48's entry). The check is fail-quiet - a rate limit, an offline
    machine, a 404, a timeout, or malformed JSON all return HTTP 200 with
    `checkFailed: true` and no notice, never an error state. GitHub's API
    rejects a request
    with no `User-Agent`, the same trap AniList and animethemes.moe already
    required a header for (features 3 and 48). Updated
    `project-plan.md` §8. A follow-on fix
    (`blueprint/history/fixes/packaging-version-guard.md`) then made
    `bun run package` fail when the version baked into `.output` or a tag on
    `HEAD` disagrees with `package.json`, since a binary published under a
    tag it does not carry would show its users a permanent, unclearable
    "update available" notice.
55. **Bulk add-all + download-all parity for anime search results** -
    done. Added and built 2026-09-04. `/cards`' Anime add-candidate
    group (`CardAddAnimeResults.vue`, feature 49a) gained the same bulk
    actions the Artist group (`CardAddArtistResults.vue`, feature 49b)
    already had: an "Add all" button that adds every theme for the
    expanded anime in one action, and a "Download all" button that
    downloads every added card's remaining source (video and audio).
    Also extended the Artist group's own "Download all"
    (`downloadAllVideos`/`hasDownloadableAddedVideos`, renamed to
    `downloadAllMedia`/`hasDownloadableAdded`) to cover audio as well as
    video - it had been video-only since 49b shipped, silently leaving
    every bulk-added theme's audio remote-only. No server route changes;
    both groups' bulk actions are client-side loops over the same
    per-card `/api/cards` and `/api/cards/download` endpoints each
    already called one row at a time.
56. **Card notes (Migaku-style memory notes)** - done. Added and built
    2026-09-04. A free-text `notes` field per card, editable from every
    existing Edit surface - `CardPreviewModal`, `/study`'s
    `StudyCardEditPanel`, and `/cards`' inspector edit form - and shown in
    `StudyInfoPanel` during both Study and Preview as a personal mnemonic
    aid. Subject to the same Hide Info blur as the rest of the panel, and
    absent entirely (no empty "Notes" row) for a card with no notes set.
57. **Ultrawide/large-screen layout cap** - done. Added to
    `build-plan.md` 2026-09-04 after a report that `/study`'s layout grows
    unbounded dead space on ultrawide monitors: `.study-grid` is
    `1fr 480px`, so the video pane takes all remaining width, but
    `.player-frame` is height-capped at a locked 16:9 aspect ratio and
    simply stops growing past a certain window width - past that point,
    extra monitor width becomes growing empty margin rather than more
    usable layout. No breakpoint above 820px exists anywhere in
    `main.css` today (feature 50h's narrow-window pass only handles the
    small end). The fix caps and centers the app's shared
    `.app-content` wrapper (`nuxt-app/app/layouts/default.vue`) above
    roughly 2560px of viewport width, which bounds every page uniformly
    since each page renders inside that one wrapper - no per-page changes
    needed. Below that width, every screen's existing full-bleed look
    (feature 50) is completely unchanged. Amended `project-plan.md` §7's
    App layout bullet to record the exception.
58. **Import from AniList/MyAnimeList (Completed list)** - done. Added to
    `build-plan.md` 2026-09-05. Enter a public username (no OAuth,
    no stored account link) and browse that user's Completed-status anime
    list as add-candidates - title, cover, already-added check - in the
    same picking flow as the existing Anime search group on `/cards`
    (feature 49a): expands inline into a theme picker, no automatic bulk
    card creation. Reached from an "Import from AniList / MyAnimeList"
    button on `/cards`, backed by `GET /api/lookup/anilist-list` and
    `GET /api/lookup/mal-list`. AniList's `MediaListCollection` query is
    public and unauthenticated for a public list, reusing the same GraphQL
    client features 3/37a/49a already use.

    **MAL support does not use Jikan, despite what this feature was spec'd
    with.** It was built against Jikan (https://jikan.moe), the unofficial
    no-key REST wrapper over MAL's public data, because MyAnimeList's
    official API requires an OAuth2 token even to read a public list. Live
    testing on 2026-09-11 found Jikan's animelist endpoint returning HTTP
    504 "Jikan failed to connect to MyAnimeList" on every attempt, on both
    URL shapes, while Jikan's other endpoints were healthy - MAL refusing
    Jikan's scrape, not an outage to wait out. The
    `mal-list-direct-lookup` fix (2026-09-12) replaced it with a direct
    call to MyAnimeList's own public list endpoint
    (`myanimelist.net/animelist/<user>/load.json?status=2`), which is the
    page Jikan was scraping and needs no key, no cookie, and no
    browser-spoofed header. `server/lib/jikan.ts` was deleted;
    `server/lib/mal.ts` replaces it. MAL answers `400` both for a username
    that does not exist and for one whose list is private, with no way to
    tell them apart, so `MalUserNotFoundError` covers both.
59. **Auto Download setting** - done. Added to `build-plan.md` 2026-09-12.
    A persistent Settings toggle (default off, in the existing Playback
    section) that, while a card is loaded in Study or Preview, automatically
    downloads its clip into the local media library instead of relying on
    the manual per-card Download button (feature 8) or feature 41's
    streamed/cached playback - video when Playback mode (feature 43) is
    Auto and the card has a video source, audio otherwise, using the same
    `mediaKind` resolution the player already uses for playback. A no-op,
    with no error surfaced, when no default download folder is configured
    or the card already has a local file for the chosen kind. Implemented
    as a single trigger inside `StudyMediaPlayer.vue` (the component shared
    by `/study` and `CardPreviewModal`), reusing feature 42's existing
    `retryDownload` mechanism rather than a new download code path - so it
    also transparently benefits from feature 41's stream cache (an
    already-cached clip is copied locally instead of re-fetched) and from
    the `recreate-missing-download-folder` fix.
60. **AnisongDB as the primary lookup and media source** - in three
    sub-features, all done. Added to
    `build-plan.md` 2026-09-13 after
    animethemes.moe was measured answering with 1-3s media TTFB and roughly
    0.75s GraphQL search, which is what makes adding a card and first-playing
    a clip feel slow (its REST API measured slower still, at 1.4-2.2s, so
    there is no win available inside animethemes.moe itself). Adds AnisongDB
    (https://anisongdb.com, the public REST API behind Anime Music Quiz) as
    the preferred source for OP/ED metadata and clip URLs, keeping
    animethemes.moe as the fallback for anything it does not cover.
    Automatic with silent fallback, deliberately not a `/settings` choice -
    the only difference between sources is speed, so there is nothing for the
    user to decide and no setting that can be left on the slow option by
    accident. Every AnisongDB entry carries `linked_ids.anilist`, so it maps
    onto the existing AniList-keyed schema with no new ID system; a random
    15-anime sample drawn from animethemes.moe resolved 14 of 15 through
    AnisongDB by MAL id. Clip files are served from AMQ's own distribution
    hosts (`naedist`/`eudist.animemusicquiz.com`), which unlike
    animethemes.moe send `Access-Control-Allow-Origin: *` and answer a bare
    `HEAD`. Added a §3 Features amendment and a §5 Tech line to
    `project-plan.md`.
    - **60a. AnisongDB client + anime theme import** - done 2026-09-13. The
      API client (`server/lib/anisongdb.ts`, `POST /api/mal_ids_request`),
      theme-slot mapping (`"Opening 1"` -> `"OP1"`, insert songs dropped), the
      stream/download host allowlist, AniList's `idMal` carried through so an
      AniList-keyed import can address a MAL-keyed provider, a resolver
      (`server/utils/themeSource.ts`) that queries both providers in parallel,
      and `/api/lookup/import` wired to it. Two things were learned in the
      build and are load-bearing for 60b/60c. First, the providers **number
      slots differently** - BanG Dream! Ave Mujica's ED1 on animethemes.moe is
      AnisongDB's `Ending 2` - so the merge pairs on normalized **song title**,
      not slot; a 12-anime probe found 7 of 29 slots disagreeing on title, 2 of
      them genuinely different songs, which a slot merge would have turned into
      a card titled one song that plays another. A real romanization
      difference deliberately fails to match and stays on animethemes.moe
      rather than guessing. Second, `upsertSong` overwrote `titleNative` and
      `animethemesThemeId` unconditionally on conflict, unlike `upsertAnime`,
      so a re-import through the sparser provider would have wiped both; it now
      drops null keys from its update set the same way.
    - **60b. Song and artist search** - done 2026-09-13. Repoints
      `/api/lookup/song-search`, `/api/lookup/artist-search`, and
      `/api/lookup/artist-import` at AnisongDB with the same fallback.
    - **60c. Re-source existing remote-only cards** - done 2026-09-13. A
      Settings action that re-resolves cards still holding animethemes.moe
      URLs and no local file, swapping in the faster host where a confident
      match exists.
61. **Card deletion and bulk delete** - done, in three sub-features. Added to `build-plan.md` 2026-09-13 after a report that
    cards could not be deleted. `DELETE /api/cards` and feature 17's file
    cleanup already worked; the gap was that since feature 50c, Delete
    lives only in `/cards`' inspector rail, one card at a time, with no
    confirm, no bulk action, and nothing on `/decks` detail rows. Deleting
    also left the card's feature-41 stream-cache files behind until quota
    eviction. `ReviewLog` and `DeckCard` rows already cascade (foreign keys
    are on). **Decision:** orphaned `Song`/`Artist`/`Anime` rows are kept
    as a local metadata cache, not pruned, so re-adding an anime later
    skips a fresh provider lookup.
    - **61a. Stream-cache cleanup + bulk delete endpoint** - done 2026-09-13.
      `deleteCards(ids)` (`server/utils/cards.ts`) deletes rows in one
      statement, then removes local files and cached stream files
      (`removeCachedStream`, `server/utils/streamCache.ts`) that no remaining
      card references - checked after the delete, so cards deleted together
      that share a file still free it. `DELETE /api/cards` accepts `{ ids }`
      (1-500, `parseDeleteBody` in `server/utils/cardDelete.ts`) returning
      `{ deleted, notFound }`, alongside the unchanged `{ id }` form. Single
      delete was confirmed working first; the original report was that its
      only button sits at the bottom of `/cards`' inspector.
    - **61b. Multi-select + bulk delete UI on /cards** - done 2026-09-13.
      A checkbox cell beside each table row's button (not inside it), a
      tri-state header checkbox over the loaded rows, shift-click ranges, and
      a sticky selection bar with an inline two-step confirm. Deletes go
      through one page function, `deleteSelected(ids)`, in sequential batches
      of 500 (`chunkIds`, `app/utils/cardSelection.ts`); a failed batch leaves
      the undeleted cards selected with the error shown. Selection clears on a
      new search. The inspector's single Delete gained the same confirm. Known
      pre-existing issue, not addressed: between the 820px breakpoint and
      about 1100px the table's Song column measures 0px wide.
    - **61c. Delete-all-matching + deck-detail parity** - done 2026-09-13.
      `GET /api/cards/ids?q=` (`listCardIds`, `server/utils/cards.ts`)
      returns every card id matching `cardSearchCondition`, unpaged, and
      rejects a blank query with `400` (`parseMatchingQuery`), so it can
      never match the whole library. `/cards` shows a "Delete all N
      matching" bar with an inline confirm only while a search is active;
      Confirm fetches the ids and runs them through 61b's
      `deleteSelected`. `/decks` detail rows on all three deck types gained
      a per-row Delete with a one-row inline confirm; on created decks it
      sits beside Remove and its copy says it deletes from the library, not
      just the deck. A review fix made `deleteSelected` reload the first
      page whenever cards remain unloaded, since deleted rows shift later
      page offsets and an emptied list hid the infinite-scroll sentinel,
      showing "No cards yet" while cards remained.
62. **Cute/moe soft retheme** - done, in two sub-features. Added to `build-plan.md` 2026-09-14. Replaces
    feature 50's Akiba Neon arcade look with a cute, moe, lo-fi one: a
    gruvbox-inspired soft dark palette (warm charcoal-brown ground, cream
    text, muted pastel accents with rose primary and light sky blue
    secondary), playful handwritten Japanese-capable fonts (Yusei Magic for
    display, Klee One for body), and rounder corners. A retheme only, like
    feature 50: no data model, route, or behaviour changes, and no layout
    change beyond removing the rail's logo tile. Cute/moe takes priority over
    the Akihabara arcade style; decorative art or mascots are not part of it.
    The look was locked on a design canvas
    (https://claude.ai/code/artifact/5b66c1b4-df8d-40c3-af72-8125b93dd267),
    whose artboards are saved under
    `blueprint/reference/cute-moe-soft-retheme/`: the user picked Option B
    "Rose & sky" (`RoseSky*` files, `Main.dc.html` is its Study) with the
    Yusei Magic + Klee One pairing; Option A (rose and sage, rounded fonts)
    and Option C "Twilight" are kept there unchosen. Rewrote
    `project-plan.md` §7's first two bullets.
    - **62a. Palette, fonts, and radii tokens** - done 2026-09-14. Every
      color token in `main.css` took Option B's value under its existing
      name (ground `#2a2826`, text `#ebdbb2`, `--accent` `#e8a4bd`,
      `--accent-secondary` `#a3c9e2`, `--pass` `#b3c98a`, `--fail`
      `#e98a72`; glows, `--shadow-soft`, and glass colors re-derived), the
      Google Fonts link loads Yusei Magic and Klee One (400, 600),
      `--radius`/`--radius-sm` went from 6px/4px to 14px/10px, and
      `NavBar.vue`'s `歌` logo tile was removed. Klee One's heaviest face is
      600, so the app's 700-900 weights render with it. Google splits both
      families into ~120 unicode-range subsets loaded on demand, so
      `document.fonts.check()` stays false and cannot verify them - measure
      rendered width instead. Left for 62b: native checkboxes still in
      browser blue/grey, seven hard-coded `border-radius` pixel values
      (`/cards`' 3px VID/AUD `.badge`), and `--faint` on `--surface-raised`
      at 3.9:1.
    - **62b. Hard-coded color sweep + contrast pass** - done 2026-09-14.
      Every color literal left in components moved onto new `main.css`
      tokens: `--scrim` (all five modal backdrops), `--veil-paused`,
      `--veil-error`, `--veil-status`, `--record-groove`,
      `--record-hole-ring`, `--record-shadow`, and `--text-shadow-overlay`,
      all in the palette's warm brown-black or cream rather than violet or
      pure black. The visualizer ring's canvas mask reads `--accent` through
      `getComputedStyle` once per loop start. `body` sets `accent-color:
      var(--accent)` and `color-scheme: dark`, so native checkboxes are rose
      and never white; `--radius-xs` (6px) rounds cover thumbnails, and VID/AUD
      badges are pills. `--faint` rose to `#b0a08d` (4.56:1 on
      `--surface-raised`, every text token now 4.5:1+ on every surface), and
      one global `:focus-visible` ring uses `--focus-ring` (sky). The only
      follow-up left open: the active segment in segmented controls (Decks,
      Stats) is marked by a fill 1.13:1 against its surface.
63. **Mascot (Temi)** - done. Added to `build-plan.md` and built 2026-09-14.
    Temi, a pink-twintailed girl in headphones sitting at a school desk with
    a red quiz buzzer, becomes the app's face: a face-crop favicon and touch
    icon, the hero art on Home's dashboard, and a small companion on the
    "all caught up" state on `/study` and the empty-library states on
    `/cards` and `/decks`. The source is a 1254x1254 transparent PNG
    (1.35MB), saved under `blueprint/reference/mascot/`; the app ships
    resized, optimized copies under `nuxt-app/public/`, which `bun run
    package` already copies beside the binary, so they work offline. She
    stays out of working surfaces - the rail (whose logo tile 62a removed),
    the Study player and info panel, tables, and modals. No data, route, or
    behaviour changes. Added a §7 bullet to `project-plan.md`. As built: a
    `components/mascot/MascotTemi.vue` component (`size: "hero" |
    "companion"`, `alt` defaulting to `""`, fixed `width`/`height` so nothing
    shifts on load) renders `/mascot/temi-320.webp` with a
    `/mascot/temi-640.webp` 2x `srcset`; `favicon.ico` (16/32/48, 15KB, was
    285KB) and a 180px `apple-touch-icon.png` are linked from
    `nuxt.config.ts`. The hero image is 150px, 96px under 820px; companions
    are 96px. Regeneration commands are in the feature's archive.
64. **Clip source setting** - done. Added to `build-plan.md`
    2026-09-14 after clips were still being streamed and downloaded from
    animethemes.moe despite feature 60 preferring AnisongDB. 60a's merge in
    `server/utils/themeSource.ts` keeps animethemes.moe URLs for a theme
    AnisongDB has no title match for, for a kind AnisongDB lacks
    (`match.videoUrl ?? known.videoUrl`), and for every theme of an anime
    with no MAL id; 60b's song/artist search falls back wholesale on an
    AnisongDB outage; pre-60 cards and deck-import manifests still carry
    animethemes.moe URLs. A persistent Settings choice in the Playback
    section, `clipSource`: `"anisongdb"` (AnisongDB only, the default),
    `"both"` (AnisongDB preferred, animethemes.moe fallback - feature 60's
    behaviour), or `"animethemes"` (animethemes.moe only). It governs clip
    URLs only; animethemes.moe metadata (native song titles, theme ids) is
    used in every mode. Stored URLs are never deleted when the setting
    narrows.
    - **64a. Setting + fetch-time enforcement** - done 2026-09-14. The stored
      setting (migration `0015`, `getClipSource`/`setClipSource`,
      `POST /api/media-library/clip-source`) and a Settings control in the
      Playback section. `isClipUrlAllowed` (`server/utils/clipSource.ts`, the
      one host-to-provider map) is enforced by `assertClipUrlAllowed`
      (`server/utils/clipSourceGuard.ts`) in `/api/media/stream`,
      `/api/media/prefetch`, and `/api/cards/download`, which return `403`
      for an excluded host before any cache lookup, so an already-cached clip
      is refused too. `parseAllowedStreamUrl` is unchanged and still the
      open-proxy guard and the stream-cache cleanup check. Feature 64c also skips excluded playback URLs in Study and Preview.
    - **64b. Import-time clip filtering** - done. Anime, song, and
      artist import and deck import keep only allowed clip URLs; a theme
      left with no allowed clip still shows in results, disabled, with a
      note saying why.
    - **64c. Existing cards under a narrower setting** - done.
      Study and Preview skip a blocked URL (playing the other kind when it
      is allowed); a card with nothing allowed shows the existing error
      state with a hint pointing at 60c's re-source action, which honours
      the setting.

65. **Typed anime answers on Study** - done 2026-09-15. A remembered, default-off
    Study toggle enables online anime autocomplete, including anime outside the
    library. Keyboard or mouse selection followed by submission records
    Pass/Fail, then pauses on an animated result with the revealed answer,
    points, and combo feedback while playback continues. A separate Continue
    action or later Enter press advances. Search failures never grade.
66. **Multi-category typed answers** - done, in two sub-features (66a
    category settings menu plus the Opening/Ending number category, 66b the
    Song name category). See the Features paragraph above for the full
    scope; both are built and merged.
67. **Dynamic scoring feedback on Study** - done. Added to `build-plan.md`
    2026-09-19 and built the same day. Makes features 65/66's scoring feel arcade-like
    rather than a static number in the header: a "+N" burst animates over the
    player where the answer was given and travels toward the session score
    chip before fading, the chip's total counts up with a pulse, a growing
    combo gets escalating emphasis, and the result panel's bonus rows pop in
    staggered. Presentation only - point values, grading, SRS scheduling, and
    every stored shape are untouched, and all motion is suppressed under
    `prefers-reduced-motion`. No `project-plan.md` change: §7's feature-65
    bullet already describes an energetic result panel and session
    score/combo, so this sharpens a documented capability rather than adding
    a product direction, the same call feature 66 made.
68. **Deeper review stats** - added to `build-plan.md` 2026-09-19, in four
    sub-features; 68a is built and merged, 68b-68d are not yet built. Turns
    `/stats` from three KPI tiles, one
    chart, and a By Artist / By Title breakdown into a real analytics page
    using only data already on disk. `server/utils/stats.ts` reads just
    `ReviewLog.result` and the date part of `ReviewLog.reviewedAt` today:
    `boxBefore`/`boxAfter`, `reviewedAt`'s time component, and `Card`'s
    `box`/`streak`/`nextReviewAt` are all stored and entirely unused by
    stats. Every metric is therefore retroactive over the full review
    history, with no schema change, no new logging, and no change to what
    Study records - deliberately chosen over persisting features 65-67's
    typed-answer score/combo (session-only client state today), which would
    have started empty. Sectioned single page in the existing 50e/62 panel
    styling. Goes deeper than Home's "Last 30 days" and "Weakest decks"
    panels (feature 50f) rather than restating them. No `project-plan.md`
    change: §3's "Review stats - guess-rate tracking, sliceable by artist
    and by anime" already covers this surface, so this deepens a documented
    capability rather than adding a product direction, the same call
    features 66 and 67 made.
    - **68a. Collection health + review forecast** - box 1-5 distribution,
      percent mature, never-reviewed count, and a due-cards forecast for
      today, the next 7 days, and the next 30. Box 1 shows streak-to-graduate
      progress rather than one step, since `computeNextBoxState` requires
      `boxOneStreakRequired` (default 3) consecutive passes to reach box 2.
      Pure `Card` state, no log analytics, and it establishes the section
      pattern 68b-68d follow.
    - **68b. Retention by box + trends** - pass rate per `boxBefore`, a
      7-day rolling average on the existing reviews chart, a week-over-week
      pass-rate delta, most-improved and most-declined decks by recent
      versus older rate, and an OP versus ED split by `Song.themeSlot`.
    - **68c. Activity heatmap + records** - a calendar heatmap of review
      volume, hour-of-day and weekday performance from `reviewedAt`'s time
      component, and a records panel: longest streak ever (`getStudyStreak()`
      returns only the current one today), best single day, total days
      studied.
    - **68d. Leeches and trouble cards** - worst cards by fail count,
      current fail streak, and a separate never-passed list, each row
      opening the existing `CardPreviewModal`. Last of the four because it
      is the only one adding an interactive modal to `/stats`, which that
      page has never had.
69. **Homepage study activity heatmap** - added to `build-plan.md` and
    built the same day, 2026-09-20. A GitHub-contribution-style calendar
    heatmap on Home's dashboard (`/`), showing cards studied (review count)
    per day over roughly the past year (53 weeks, calendar-aligned
    Sunday-start, ending today - future days in the current week render
    blank), colored by a 5-tier relative intensity scale, with a
    native-`title` hover tooltip giving the exact date and count, matching
    the existing "Last 30 days" bar chart's own tooltip convention (feature
    50f). Purely additive next to that existing panel - no changes to what
    it shows, no schema change, and it reads `ReviewLog.reviewedAt` through
    the same local-date grouping helpers `server/utils/stats.ts` already
    exposes (following the same DB-fetch/pure-shape-function split feature
    68a established, so the grid-building logic - week alignment,
    zero-fill, month labels - is independently unit-testable). Distinct
    from feature 68c's planned calendar heatmap: 68c is a `/stats`-page
    heatmap bundled with hour-of-day/weekday performance and a records
    panel; this is a Home-page dashboard glance, unrelated in placement and
    scope. No `project-plan.md` change, the same call features 66-68 made.
    A same-day revision defaults the panel to a single-month calendar
    highlight instead of opening on the full year grid: `app/utils/
    monthHeatmap.ts` exports a pure `buildMonthHeatmap()` that filters the
    same fetched `heatmap.weeks` days into one real Sunday-first calendar
    month (leading/trailing cells padded, `maxCount`/`totalReviews` scaled
    to that month alone rather than the year's) - no extra API call. A
    `tab-seg`/`tab-seg-btn` toggle (the same convention `/decks` and
    `/stats` already use) switches to the unchanged year view and back.
70. **Filter cards without an AnimeThemes.moe match** - added to
    `build-plan.md` 2026-09-20, in two sub-features, both now built and
    merged. AMQ's
    faster clip hosting (feature 60) means AnisongDB is now the preferred
    metadata/clip source, but its catalog is broader than AnimeThemes.moe's
    curated one, so a theme can be added to a card's library with no
    AnimeThemes.moe counterpart backing it at all. This lets a user identify
    and remove those cards while leaving Clip source (feature 64) exactly as
    configured - it is about which cards are visible/selectable, never about
    which host serves a clip.
    - **70a. Library filter + bulk cleanup** - a toggle on `/cards`
      (`missingAnimeThemes` query param, mirroring the existing `?q=`
      round-trip) narrows the list, and the existing "Delete all N matching"
      bulk action, to cards whose `Song.animethemesThemeId` is null. That
      bulk-delete bar's visibility condition loosens from "a text search is
      active" to "a text search or the new toggle is active," while
      `/api/cards/ids` still refuses to run with neither set, so it can
      never accidentally match the whole library. Deck-detail views
      (`/decks`) are unaffected - this is a `/cards`-library-only surface,
      like feature 61b/61c's bulk-select UI before it.
    - **70b. Import-time gate** - an AnisongDB-only result in the
      Anime/Song/Artist add-candidate search on `/cards` shows disabled with
      a note explaining why, mirroring feature 64b's "a theme left with no
      allowed clip still shows in results, disabled" pattern, instead of
      being addable like a fully-matched one - so 70a's filter does not
      immediately start refilling with new unmatched cards.
71. **Per-deck grading criteria** - added to `build-plan.md` 2026-09-22, in
    three sub-features; 71a is built, 71b-71c are not. Today a card carries exactly one
    Leitner track (`Card.box`/`streak`/`nextReviewAt`) and only the anime-title
    guess drives it: features 65/66's Song name and Opening/Ending categories
    are bonus points that never touch scheduling. That makes a card studied for
    two different skills share one schedule, so passing the title pushes the
    song review out by days. This lets a manual deck declare what its cards are
    graded on - `title` (the default, today's behaviour), `song`, or `both` -
    and keys scheduling state by `(card, criterion)` so each skill advances
    independently. Manual decks only: artist and anime decks are query-time
    groupings (feature 5) with no row to hold a setting, and a user who wants
    an artist drilled by song makes a manual deck. Amended `project-plan.md`
    §3's Decks and Study session bullets and three §4 Data bullets, since it
    adds a deck-level configuration and a second scheduling dimension rather
    than deepening a documented capability.

    Four decisions were made before the feature was added, and the spec rests
    on them:
    - **No per-deck isolation toggle.** Tracks key on `(card, criterion)`, not
      `(card, deck)`. Two song-graded decks holding the same card share one
      track. The original request also asked for optional per-deck isolation of
      the same criterion (cram one deck without disturbing the long-term
      schedule); it was dropped as unneeded once criteria have their own
      tracks, and is not a build target.
    - **Title track only outside a configured deck.** `{ type: "all" }`,
      artist, and anime scopes keep serving the title track exactly as they do
      now, so the same clip can never appear two or three times in one session
      and `dueCount` keeps counting cards rather than tracks.
    - **Works with Typed Answers on or off.** Nothing forces feature 65's mode
      on; with it off the manual Pass/Fail prompt only re-words to name what is
      being self-graded.
    - **Stats stay title-only until 71c**, enforced by an explicit
      `criterion = 'title'` filter added in 71a rather than left to drift.

    Two smaller calls, recorded here because they are not obvious from the
    sub-feature lines: a card with no `CardTrack` row for the active criterion
    is treated as new and immediately due, so it starts fresh at box 1 (knowing
    a title says nothing about knowing the song), and changing a deck's
    criterion later keeps the old track's rows rather than deleting them.
    - **71a. Criterion-keyed scheduling tracks** - done 2026-09-22. The schema and
      server plumbing, with no way to set a criterion yet, so the app behaves
      exactly as it does today. `Deck.gradingCriterion`, the `CardTrack` table,
      and `ReviewLog.criterion`; `dueCardCondition`/`getNextDueCard`/
      `getDueCardCount`/`getUpcomingDueCards`, the daily new-card counting in
      `getNewCardsTodayInfo`/`getWithheldNewCount`, and `recordReview` all
      resolve a criterion from the study scope and operate on that track. The
      `Card` row stays the title track, so there is no backfill and every
      existing query keeps working unchanged. Stats, Home, and the deck
      pass-rate tiles filter to the title track.
    - **71b. Deck criterion setting + Study grading** - not built. The control
      on `/decks` that sets a manual deck's criterion, and Study grading by it:
      with Typed Answers on the criterion's categories are forced on and drive
      Pass/Fail (a blank required answer counts as a fail), with it off the
      manual prompt re-words. `StudyInfoPanel`'s box and learning-streak
      readout follows the active track.
    - **71c. Track-aware stats** - not built. Slices `/stats` and the deck
      pass-rate tiles by criterion instead of hiding non-title tracks, so song
      and combined drilling shows up in retention, leeches, and the activity
      charts. Last of the three because it is the only one that touches feature
      68's whole surface.

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
  streak: number;
  nextReviewAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  songTitle: string;
  songTitleNative: string;
  themeSlot: string;
  artistId: number;
  artistName: string;
  animeId: number;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  animeCoverImageUrl: string | null;
}
```

The server-side declaration (`server/utils/cards.ts`) types `nextReviewAt` and
`createdAt` as `Date`, not `string`; the client-side copy above is the
post-JSON wire shape. See F-09 (or its archived resolution once closed) for
why these are two hand-maintained declarations rather than one shared type.

### ReviewLog

Backs the guess-rate stats feature (7) and is written by every
`POST /api/study/review` call (feature 6a).

- `id` (integer, PK)
- `cardId` (FK -> Card, cascades on delete)
- `reviewedAt` (datetime, default now)
- `result` (`"pass"` | `"fail"`)
- `boxBefore` (integer)
- `boxAfter` (integer)
- `criterion` (text, not null, default `"title"`, values `"title" | "song" |
  "both"`) - added in feature 71a. Which scheduling track this review advanced.
  Every pre-71 row defaults to `"title"`, which is what they all were. Stats
  and the daily new-card count filter on it.

### CardTrack

Feature 71a. One Leitner scheduling track per `(card, criterion)`, for
**non-title criteria only**. The `Card` row itself is the `title` track, so
this table starts empty, nothing is backfilled, and every query written before
feature 71 keeps working untouched.

- `id` (integer, PK)
- `cardId` (FK -> Card, cascades on delete)
- `criterion` (text, `"song" | "both"`) - never `"title"`; that track lives on
  `Card`
- `box` (integer, default `1`)
- `streak` (integer, default `0`)
- `nextReviewAt` (datetime, default now)
- Unique on `(cardId, criterion)`

A card with no row for the criterion being studied is new and immediately due,
so it starts at box 1 rather than inheriting the title track's progress.
Changing a deck's `gradingCriterion` leaves existing rows in place; nothing
prunes a track whose deck no longer uses it.

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
- `autoDownload` (boolean, not null, default `false`) - added in feature 59.
- `clipSource` (text, not null, default `"anisongdb"`, values `"anisongdb" |
  "both" | "animethemes"`) - added in feature 64a. Which providers' hosts
  clip files may be streamed or downloaded from.
- `themesOnly` (boolean, not null, default `false`) - added by the
  `themes-only-mode` fix (2026-09-21). Off: any AnisongDB song can be added
  and studied. On: Study and due counts only serve cards whose
  `Song.animethemesThemeId` is set, and feature 70b's import gate applies;
  otherwise that gate is inactive. Imports still record the AnimeThemes match
  either way.

`Song.animethemesCheckedAt` (nullable datetime, added by the
`animethemes-match-backfill` fix, 2026-09-22) - separates "AnimeThemes.moe
was probed and has nothing" from "never checked", since `themesOnly` and
feature 70a's library filter both read `animethemesThemeId IS NULL` as
absent. Cards imported before feature 70b's match lookup existed had a null
id nobody had ever checked; an explicit Settings action (mirroring the
cover-art and clip-source backfills) probes them once, one AnimeThemes
lookup per anime, and stamps checked-at whether or not a match is found so a
genuine miss is never re-probed. Run once against the live library on
2026-09-22: 103 unchecked songs, 73 matched, 30 genuinely absent.

> **Artist/Anime decks stay derived** - query-time groupings of `Card` joined
> through `Song` by `artistId` or `animeId`, not a stored entity. Manual
> decks (feature 13) are the one deck type that *is* stored, via the
> `Deck`/`DeckCard` shapes below.

### Deck

Feature 13a. A user-created, flat (no parent/child) named deck.

- `id` (integer, PK)
- `name` (string, unique) - trimmed and duplicate-checked before insert, not
  relying on the DB constraint as the primary validation path
- `gradingCriterion` (text, not null, default `"title"`, values `"title" |
  "song" | "both"`) - added in feature 71a. What a card is graded on while
  studying this deck, and therefore which `CardTrack` its reviews read and
  write. Manual decks only; artist and anime decks are derived and have no row
  to hold this.
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
type StudyScope = { type: "all" } | DeckRef | { type: "created"; id: number };
```

`created` is a manual deck (feature 13), added to `StudyScope` by the
`study-manual-deck` fix (2026-09-14) and filtered through `DeckCard`
membership in `dueCardCondition`. It is deliberately not part of `DeckRef`,
which deck export still uses and which still covers only artist/anime.

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

Feature 71a (built 2026-09-22) does not change any of the above. It changes
only *where* that state is stored: the same 5 boxes and intervals, applied per
`(card, criterion)` track instead of once per card. `computeNextBoxState` is
already pure and takes box/streak as arguments, so it is reused unchanged.

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
- **AnisongDB REST API** (`anisongdb.com`) plus **AMQ media hosts**
  (`naedist.animemusicquiz.com`, `eudist.animemusicquiz.com`) - in use as of
  feature 60 for anime import (60a), song and artist search (60b), and
  re-sourcing existing remote-only cards (60c). Unofficial,
  no-key public API behind Anime Music
  Quiz; preferred over animethemes.moe for OP/ED metadata and clip URLs on
  latency grounds, with animethemes.moe kept as the fallback. OpenAPI spec at
  `https://anisongdb.com/openapi.json`. Media entries are bare filenames
  (`byvisp.webm`, `qi299l.mp3`) resolved against a distribution host, so the
  client owns host selection and fallback. Since feature 64a, the Clip source
  setting defaults to AnisongDB as the only host clips may stream or
  download from; animethemes.moe clips are fetched only in its Both or
  animethemes.moe-only modes. Import still stores animethemes.moe URLs until
  64b.
- **MyAnimeList public list endpoint**
  (`myanimelist.net/animelist/<user>/load.json?status=2`) - added in feature
  58, used only to read a public username's Completed anime list. Not an
  official API: MAL's official one requires OAuth even for a public list,
  and Jikan (`api.jikan.moe`), the unofficial wrapper feature 58 was
  originally built on, was dropped on 2026-09-12 after MAL began refusing
  its scrape with a permanent `504`. This is the same page Jikan was
  scraping, called directly. Requires the project's `User-Agent`; returns
  `400` for both a missing user and a private list.
- **Japanese morphological analyzer** (e.g. kuroshiro/kuromoji) - added in
  feature 6c for furigana generation
- **Node `fs`** - reads the user-configured local media library and writes
  files downloaded by feature 8, and removes files feature 17 cleans up
- **Vitest** - added 2026-09-04 alongside feature 54. Run with
  `bun run test` from `nuxt-app/`. Two test files written for feature 48
  already existed and imported from `vitest`, but the runner had never been
  installed, so neither had ever run. The logic-test gate in
  `coding-standards.md` is on as a result: a build step adding in-scope
  logic ships a passing test in the same diff.

## Monetization

Non-profit. No monetization planned.

## UI/UX

- **Feature 65:** Study has a remembered Typed Answers toggle,
  off by default. Its online anime suggestions and submission control replace
  manual review controls while enabled. A saved answer reveals an energetic
  result panel and session score/combo, keeps the song available for listening,
  and waits for a separate Continue action. Ordinary manual review remains
  available when switched off.

**Current look (feature 62, 2026-09-14):** cute and moe first - soft,
playful, a little cartoony, read through a lo-fi gruvbox-inspired palette: a
warm charcoal-brown ground, cream text, and muted pastel accents (rose
primary, light sky blue secondary) in place of neon, with playful handwritten
Japanese-capable type (Yusei Magic display, Klee One body) and rounded
corners on panels and controls, full pills kept for buttons and badges. The
rail has no logo tile. Cute/moe takes priority over the Akihabara arcade
signage style feature 50 introduced. Every color a component uses comes from a
`main.css` token, including modal scrims, the player's veils and record, and
native form controls; keyboard focus shows one sky-blue ring everywhere.
Temi, the mascot (feature 63), appears on Home's hero, on `/study`'s
all-caught-up state and the empty `/cards` and `/decks` states, and as the
favicon, never on working surfaces.

**Before 62a (feature 50):** Akihabara arcade signage - the same
otaku-culture reference, read through neon storefronts and game-centre
panels. Dark blue-black ground, sakura pink primary accent, cyan secondary;
tight radii on panels and controls, with full pills kept for buttons and
badges.

Unchanged by either: a persistent left rail navigates, and content sits in split panes using the
full window width instead of a centered single column. Past roughly 2560px
of viewport width, the main content column caps and centers itself instead
of continuing to stretch (feature 57) - full-bleed below that
width is unchanged; the cap only prevents unbounded dead space on
ultrawide/super-ultrawide monitors. Japanese text renders
as real, selectable DOM text (never baked into an image or video) so the
Migaku browser extension can attach to it. Theme tokens (colors, fonts,
radii) live in `nuxt-app/app/assets/css/main.css`.

**Feature 50's shipped state** (2026-09-03), whose token values feature 62a replaced on 2026-09-14:
tight radii, the blue-black ground, cyan `--accent-secondary`, RocknRoll One
+ Zen Kaku Gothic New, and the left rail replacing the earlier top nav bar
(`NavBar.vue` is now the rail - same component, restyled by 50a, not
renamed). The design reference is
`blueprint/reference/design_handoff_anisong_srs_redesign/Redesign.dc.html`;
token deltas actually shipped are in feature 50's entry. The one decision
left open by that feature's original scope note - which Study
fullscreen/ambient-overlay candidate, if any, should replace feature 31's
immersive mode - was answered by feature 53 with the `#2b` "Bottom bar"
candidate, which was then rolled back. `/study` has had no immersive or
expand mode since 2026-09-03; the mechanism survives only in
`CardPreviewModal`. Study is the rail plus player plus side info panel,
with no fullscreen surface.

Established conventions across every page/route built so far: `useFetch` for
the initial load (with explicit loading/error states, never just the happy
path), `$fetch` for mutations, scoped `<style>` blocks using `var(--token)`.
A list row whose only control is one button fires that action when the row
itself is clicked (shared `.row-clickable` class in `main.css`, the button
keeping `@click.stop`), and stops once the row has more than one action -
the `click-single-action-rows` fix (2026-09-14).
No dynamic route segments (`[id].ts`) exist anywhere yet - every route uses
query-string parameters (`/decks`' `?type=&id=`, `/cards`' `?q=`) or a
body-carried `id` for mutations, and that convention should continue rather
than mixing in a new one. A page reading a query param should handle both
first mount and a later same-route navigation (a `watch`, not just
`onMounted`), since the nav bar is on every page and can navigate a page to
itself with new params without remounting it.

Routes:

- `/` - done (feature 15). A launcher hub with links to Study, Cards, Decks,
  Stats, Settings - no live data, no dashboard stats, plus a persistent nav
  bar in a shared Nuxt layout, present on every page. Feature 50f (2026-09-03)
  replaced the five link cards with a real dashboard - global search +
  Add-card shortcut, a due-cards hero, a 30-day activity card, and
  weakest-decks + recently-added panels - and 50a restyled the nav bar into
  the persistent left rail. Feature 69 (2026-09-20) added a GitHub-style
  calendar heatmap of cards studied per day, additive next to the existing
  30-day activity card, defaulting to a single-month calendar highlight
  with a Month/Year toggle back to the full 53-week grid.
- `/settings` - done. Media library folder configuration, plus (feature 8) a
  default download folder picker shown once 2+ folders are configured, plus
  (feature 9) an "Import deck" form (source path -> created/skipped summary
  or per-entry errors) - this is where feature 9 resolved its own
  then-undecided placement question. Feature 41 added a stream-cache size
  control (MB input, default 1024) for the local disk cache of remote
  animethemes.moe clips. Feature 43 added a Playback mode control (Auto /
  Audio only) - the only place this setting can be changed, deliberately
  not exposed on `/study` itself. Feature 59 added an Auto Download toggle
  in the same Playback section, where feature 64a added the
  Clip source choice.
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
  by the empty state. Feature 61b's selection bar also carries a deck
  picker and "Add to deck" (`bulk-add-cards-to-deck` fix, 2026-09-14),
  backed by `POST /api/decks/cards` accepting `{ deckId, cardIds }`
  alongside `{ deckId, cardId }`. Feature 70a (planned, not built) adds a
  toggle to filter the list to cards missing an AnimeThemes.moe match, and
  extends "Delete all N matching" to work from that toggle alone.
- `/decks` - done. Artist and Anime-Title deck groupings, list + detail, plus
  (feature 9) a per-deck export control and (feature 12) anime cover
  thumbnails on anime-type decks. Feature 13a added a third "Created" toggle
  for manual decks - create/rename/delete inline, real card counts and card
  list once 13b landed, with a per-card "Remove" action found only in the
  manual-deck detail view. The export block does not appear there;
  "Study this deck" does, since the `study-manual-deck` fix (2026-09-14).
  Both headers (the deck grid and a deck's detail view) group their search,
  the By title / By artist / Created tabs, and the Study button into one
  row centered in the top bar (`center-decks-header-controls` fix,
  2026-09-14). Feature 22 added a per-row "Preview" button to the detail
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
  frame, instead of never appearing there at all). Feature 51 added a
  "Previous" button + `P` hotkey that reopens the single most recently
  reviewed card, view-only, in `CardPreviewModal` with the live player
  paused; feature 52 added a session-log popup (📋 button + `L` hotkey,
  always visible in the header) listing every card reviewed this session,
  each row opening the same way "Previous" does - both share one
  `viewedHistoryEntry`/`openHistoryCard()` mechanism, render above the
  immersive layer (`--z-above-immersive`), and disable the live Pass/Fail
  hotkeys while open. Feature 53 replaced that immersive overlay with a
  clean video plus a bottom bar, then was rolled back; a follow-on fix
  removed `/study`'s immersive and expand modes outright. **`/study` has
  no fullscreen or immersive surface today** - it is the rail, the player,
  the side info panel, and the toggle strip. The `--z-immersive` token and
  `StudyMediaPlayer`'s expand mechanism remain in use by
  `CardPreviewModal` only.
- `/stats` - done. Overall pass rate plus a By Artist / By Title toggle,
  each row's guess rate. Feature 29 added a manual "Refresh" button and a
  destructive "Clear history" action (two-step inline confirm) that wipes
  `ReviewLog` only - `Card.box`/`Card.nextReviewAt` are untouched. Feature
  68 (planned, not built) deepens this page into a sectioned analytics
  surface - collection health and forecast, retention by box and trends,
  an activity heatmap and records, and a leech list - all from data
  already stored.

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
- **Updates**: feature 54, done - the packaged build checks the
  project's GitHub releases for a newer version on launch and links to it.
  It never downloads or replaces itself, and the check failing changes
  nothing about how the app runs. Releases are published by hand from
  `bun run package`'s zipped output; there is no update channel or
  manifest beyond the GitHub releases list itself. `bun run package`
  refuses to build when `package.json`'s version disagrees with the
  version baked into `.output` or with a tag on `HEAD`, so a release
  cannot ship carrying a version it will not be published under.
- **Health check / domain**: not applicable (local-only)

## Notes

`nuxt-module/` was scaffolded during initial setup as a possible reusable
module, then removed once the plan confirmed this is a single local app.
`nuxt-app/` is the only package.
