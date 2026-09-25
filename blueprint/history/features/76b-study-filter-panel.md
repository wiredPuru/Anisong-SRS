# Feature: Study filter panel

**From build-plan:** feature 76b (parent: 76 Study filters)
**Status:** verified

## Goal

Let a Study session be narrowed by anime metadata and theme type - for example
"cute girls doing cute things shows from 2000-2009, openings only" - on top of
whatever scope it already has (all, artist, anime, or manual deck). Filters
decide which due cards are served and counted; they never change scheduling.
They are remembered across visits, and Study always shows when they are on.

## In scope

- A `StudyFilters` contract (see Data / contracts) sent as one JSON `filters`
  query param on `GET /api/study/next`, strictly validated server-side.
- Filtering inside the shared `dueCardCondition`, so the next card, `dueCount`
  ("N left"), `withheldNewCount`, and the prefetch lookahead all agree.
- `GET /api/study/filter-options`: the years, formats, genres, and tags present
  in the library, plus how many anime still lack AniList details (76a).
- A filter popup on `/study` (`StudyFiltersModal.vue`), opened from a header
  button showing the active-filter count. Edits are a draft applied with an
  Apply button; Escape or the backdrop cancels.
- Filters saved in `localStorage` (`gaqSrs:studyFilters`), like Typed Answers.
- The "All caught up" state says when filters are on, with Edit filters and
  Clear filters actions, so an empty queue is never a mystery.

## Out of scope

- User-list filtering (76c), insert songs, saved presets.
- Home, Decks, and Stats due counts: filters are a Study-session lens only.
  Home's "N due" can therefore be higher than Study's "N left" while filters
  are on; that is expected, and Study's indicator explains it.
- Per-scope filters: one filter set applies to every scope.

## Build steps

- [x] **Step 1 - Server filter contract** - `server/utils/studyFilters.ts`:
  `parseStudyFilters(raw)` (JSON string or undefined to `StudyFilters | null`,
  or an error) and `studyFilterCondition(filters)` (a Drizzle SQL condition over
  the `anime` and `song` columns already joined by every due query). *Done
  when:* tests cover each field's validation (bad JSON, out-of-range years and
  scores, min above max, unknown format or theme type, oversized lists), an
  empty filter set parsing to `null`, and the condition against an in-memory DB
  selecting the right cards for year, score, format, OP/ED, genre include (all
  required), genre exclude, tag include and exclude honouring `tagMinRank`, and
  an anime with no details being excluded by a year filter but kept by an
  exclude-only filter.
- [x] **Step 2 - Due queries honour filters** - optional trailing `filters`
  param on `dueCardCondition`, `getNextDueCard`, `getDueCardCount`,
  `getWithheldNewCount`, `getUpcomingDueCards`; `next.get.ts` parses `filters`
  and returns `400` for an invalid one. *Done when:* tests show the next card
  and due count narrowed by a filter within a scope, callers passing no filters
  (Home, stats) unchanged, and the full suite plus build pass.
- [x] **Step 3 - Filter options endpoint** - `getStudyFilterOptions()` and
  `GET /api/study/filter-options`. *Done when:* tests show only anime with at
  least one card counted, tags sorted by how many anime carry them, formats and
  genres de-duplicated, and `missingDetailsCount` matching 76a's count
  restricted to anime with cards.
- [x] **Step 4 - Client filter state** - `app/utils/studyFilters.ts`
  (`EMPTY_STUDY_FILTERS`, `countActiveFilters`, `readStoredFilters` tolerating
  missing or malformed storage, `filtersQueryValue` returning `undefined` when
  empty); `useStudySession` takes a filters ref, sends it, and refetches the
  next card when it changes; the page loads and saves it. *Done when:* util
  tests pass, and on a scratch database, setting the storage key by hand and
  reloading `/study` narrows "N left" (checked through the request URL and the
  count).
- [x] **Step 5 - Filter popup** - `StudyFiltersModal.vue` and a header
  "Filters" button with an active-count badge. Theme type and format as toggle
  pills, year and score as from/to number inputs, genres as three-state pills
  (off, include, exclude), tags as a search box adding chips that toggle
  include/exclude with a min-relevance slider, and a note linking Settings when
  anime lack details. The popup blocks answer hotkeys like the session log, and
  the button is disabled while a typed-answer result is showing or a review is
  submitting. *Done when:* on a scratch database, picking "Cute Girls Doing
  Cute Things" plus years 2000-2012 and Apply changes the card and the "N left"
  count, the badge shows the active count, Cancel discards a draft, and there
  are no console errors (screenshot captured).
- [x] **Step 6 - Empty queue with filters on** - the "All caught up" state
  names the active filter count and offers Edit filters and Clear filters.
  *Done when:* a filter matching nothing shows the note, Clear filters brings
  cards back without a reload, and no note appears when filters are off.

## Files / areas

- `nuxt-app/server/utils/studyFilters.ts` + test (new)
- `nuxt-app/server/utils/cards.ts`, `cards.test.ts` or a new focused test
- `nuxt-app/server/api/study/next.get.ts`, `filter-options.get.ts` (new)
- `nuxt-app/app/utils/studyFilters.ts` + test (new)
- `nuxt-app/app/composables/useStudySession.ts`
- `nuxt-app/app/pages/study/index.vue`
- `nuxt-app/app/components/study/StudyFiltersModal.vue` (new)

## Data / contracts

**Load-bearing (76c adds a list field to it):**

```ts
type ThemeType = "OP" | "ED";

interface StudyFilters {
  yearMin: number | null;   // integer 1900-2100
  yearMax: number | null;
  scoreMin: number | null;  // integer 0-100, AniList averageScore
  scoreMax: number | null;
  formats: string[];        // AniList MediaFormat values; empty = any
  themeTypes: ThemeType[];  // empty = both
  genresInclude: string[];  // anime must have every one
  genresExclude: string[];  // anime must have none
  tagsInclude: string[];    // every one, at rank >= tagMinRank
  tagsExclude: string[];    // none, at rank >= tagMinRank
  tagMinRank: number;       // integer 0-100, default 60
}
```

- Wire: `GET /api/study/next?...&filters=<JSON>`. Omitted, or a filter set with
  nothing active, means no filtering. Lists are capped at 50 entries of at most
  100 characters.
- Semantics: an active year, score, or format filter excludes an anime whose
  value is unknown, since it cannot be shown to match. Include lists require
  all entries (narrowing is the point). The approved rank rule applies to both
  tag include and exclude.
- `GET /api/study/filter-options` returns
  `{ yearRange: { min, max } | null, formats: string[], genres: string[],
  tags: { name: string; count: number }[], missingDetailsCount: number }`.
- Storage: `localStorage["gaqSrs:studyFilters"]` holds the JSON above; bad or
  missing data falls back to no filters.

Genres and tags are matched with SQLite `json_each` over `anime.genres` and
`anime.tags`, as 76a planned.

## Testing

Test gate is on. In-scope logic: the parser and SQL condition (step 1), the
filtered due queries (step 2), the options query (step 3), and the client
util (step 4). The popup and empty state are UI, verified in the browser
against a scratch copy of the database (steps 4-6) plus the build.

## Notes for the AI

- Never run the dev server against the live `.data/gaq-srs.db`: copy it to
  the scratchpad and set `GAQ_SRS_DATA_DIR`.
- Keep the new modal on the existing modal pattern (`StudySessionLogModal`,
  `--scrim`, `--z-above-immersive` if needed) and tokens only, no hard-coded
  colors.
- `baseDueCondition` stays filter-free: deck tiles and Home group by it.
- Leave `nuxt-app/study-loaded.yml` out of every commit.

## Outcome

Verified 2026-09-25 with `bun run test` (1077 passing) and `bun run build`,
plus API and browser evidence against a scratch copy of the live database
(`GAQ_SRS_DATA_DIR`): 103 due cards narrowed to 8 with "Cute Girls Doing Cute
Things" and 2000-2012; a malformed `filters` param returned 400; Apply showed
badge "2"; Cancel and Escape discarded drafts; a backwards year range disabled
Apply; answer hotkeys sent no review while the popup was open; a filter
matching nothing showed the caught-up note, and Clear filters restored 103
cards without a reload.

Decisions made while building, beyond the spec:
- Escape closes the popup even from a text field, since every control in it is
  an input and Escape is never typed text.
- Genre and tag chips use the pass color for "required" and the fail color for
  "excluded".

A Vue hydration mismatch warning and a canvas `willReadFrequently` warning on
`/study` predate this feature (both appear with no filters stored).
