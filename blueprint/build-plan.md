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
