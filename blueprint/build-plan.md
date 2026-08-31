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

Good:

- [ ] 1. **Skill submission** - upload a skill package and save its metadata
- [ ] 2. **Validation result** - run checks and show pass/fail status for a skill
- [ ] 3. **Directory listing** - browse and filter published skills
- [ ] 4. **Deployment readiness** - configure Render or Vercel and verify the
  production build

Avoid:

- Upload stuff
- Database
- Make it look nice
- Auth, billing, dashboard, validation, and deploy

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
- [ ] 37. **Bulk artist import** - a "search by artist" mode on `/cards/new`
  (alongside the existing anime search) that pulls in an artist's entire
  animethemes.moe catalog across every anime they have themes in, instead of
  one anime at a time.
  - [x] 37a. **Artist search + theme resolution** - find an artist on
    animethemes.moe by name, resolve every anime they have themes in via
    AniList (reusing the existing per-anime `upsertAnime`/`upsertSong`
    pipeline, looped across all of that artist's anime), and show a preview
    list of every song/theme found. No cards created yet.
  - [ ] 37b. **Bulk card creation + download** - "Add all" (and per-row
    "Add") on that preview list creates a `Card` per selected theme, plus a
    bulk "download all" option reusing feature 8's existing download
    machinery.
