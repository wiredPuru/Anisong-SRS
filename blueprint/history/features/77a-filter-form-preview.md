# Feature: Shared filter form + filtered anime preview

**From build-plan:** feature 77a (parent: 77. Build a deck from filters)
**Status:** verified

## Goal

Lay the groundwork for building a manual deck from Study's filters (feature
76) without any visible change yet. Two pieces: the filter controls become a
reusable form component that 77b can use outside Study, and a read-only server
route answers "which library anime match these filters, and how many cards
would each add?" 77b then adds the deck-side UI on top of both.

## In scope

- `listFilteredAnime(filters)` (server): library anime with at least one card
  matching `studyFilterCondition(filters)`, each with the number of matching
  cards, plus a total.
- `POST /api/decks/filter-preview` wrapping it, validating with the existing
  `parseStudyFilters`.
- `StudyFilterForm.vue`: every filter control now inside `StudyFiltersModal`
  (Theme, Anime list, Year, AniList score, Format, Genres, Tags + min
  relevance), with the filter-options fetch and the AniList/MAL list lookup,
  editing a `StudyFilters` value through `v-model`.
- `StudyFiltersModal` rebuilt around that form: it keeps only the popup shell,
  its title, the draft reset on open, Escape, the validation message, and the
  Clear all / Cancel / Apply footer. Study behaves exactly as it does now.

## Out of scope

- Any deck UI, the "From filters" entry point, show picking, and the copy
  itself - all 77b.
- Changing what any filter means, adding filters, or saved presets (76's
  out-of-scope list still stands).
- Offering anime without cards, or importing from AniList (decided: library
  only).
- The `themesOnly` setting. It limits what Study serves, not what a deck may
  hold (feature 73 copies regardless), so the preview ignores it.
- Study's saved filters (`gaqSrs:studyFilters`): untouched here and in 77b.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `listFilteredAnime` + tests** - new
  `server/utils/deckFilterPreview.ts`. One query: `card` inner join `song`
  inner join `anime`, `where studyFilterCondition(filters)`, grouped by anime,
  `count(card.id)` as `cardCount`, ordered by `titleRomaji` (case-insensitive)
  then `id`. `filters === null` (no active filter) returns every anime that has
  a card. `totalCards` is the sum of `cardCount`. Vitest with the in-memory DB
  pattern from `studyFilterOptions.test.ts`. *Done when:* `bun run test`
  passes with cases for: empty library; no filters returns every anime with
  cards and skips anime with none; a genre include/exclude; a tag below
  `tagMinRank` not matching; OP-only counts only an anime's OP cards and drops
  an anime with only EDs; an active year filter drops an anime with a null
  year; `listAniListIds: []` returns nothing; ordering.
- [x] **Step 2 - `POST /api/decks/filter-preview`** - new
  `server/api/decks/filter-preview.post.ts`. Body `{ filters?: string }`, the
  same JSON-string wire format `/api/study/next` takes (built client-side by
  `filtersQueryValue`), so `parseStudyFilters` is reused unchanged. A parse
  error is a `400` with its message; a non-object body is a `400`. POST rather
  than GET because a 76c list can carry up to 5000 AniList ids, too long for a
  query string. Read-only: it writes nothing. *Done when:* `curl` against the
  dev server returns the `FilteredAnimePreview` shape for `{}` and for a real
  genre filter, and a `400` with a readable message for
  `{"filters":"{\"yearMin\":2020,\"yearMax\":2010}"}`.
- [x] **Step 3 - extract `StudyFilterForm.vue`** - move the filter sections,
  their script (options fetch, genre cycling, tag search/breakdown/chips, list
  lookup), and their styles out of `StudyFiltersModal.vue` into
  `components/study/StudyFilterForm.vue` with `defineModel<StudyFilters>()`.
  The form fetches `/api/study/filter-options` on mount; since the modal only
  renders its body while open, that keeps today's "fresh options on every
  open". The modal keeps: shell, title, `draft` + reset on open, Escape,
  `problem` message, Clear all (which preserves `tagMinRank`, as now), Cancel,
  Apply. No new styles or tokens; moved CSS moves verbatim. *Done when:*
  `bun run build` passes, and on `/study` in a browser the Filters popup looks
  and behaves as before: options load, a genre cycles include -> exclude ->
  off, a tag search adds a chip, the relevance slider changes counts, an
  AniList username loads a list, Clear all / Cancel / Apply and the active
  count badge work, and Escape closes it. No console errors.

## Files / areas

- `nuxt-app/server/utils/deckFilterPreview.ts` (new) + `.test.ts` (new)
- `nuxt-app/server/api/decks/filter-preview.post.ts` (new)
- `nuxt-app/app/components/study/StudyFilterForm.vue` (new)
- `nuxt-app/app/components/study/StudyFiltersModal.vue` (shrinks to the shell)
- Read, not changed: `server/utils/studyFilters.ts`, `app/utils/studyFilters.ts`,
  `app/pages/study/index.vue`

## Data / contracts

No schema change, no migration.

**Load-bearing for 77b** - declared server-side in `deckFilterPreview.ts`,
hand-copied client-side in 77b in the same field order (the F-09 convention):

```ts
interface FilteredAnime {
  id: number;
  aniListId: number;
  titleEnglish: string;
  titleRomaji: string;
  titleNative: string;
  coverImageUrl: string | null;
  year: number | null;
  format: string | null;
  cardCount: number; // cards of this anime matching the filters (OP/ED narrows it)
}

interface FilteredAnimePreview {
  anime: FilteredAnime[];
  totalCards: number;
}
```

`POST /api/decks/filter-preview` - body `{ filters?: string }` -> 200
`FilteredAnimePreview` | 400 `{ statusMessage }`.

`StudyFilterForm.vue` - `v-model: StudyFilters` (the client type in
`app/utils/studyFilters.ts`), no other props or events. 77b mounts it in the
deck flow with its own draft.

77b's copy must add exactly the cards this preview counted for the picked
anime: the same `studyFilterCondition` plus `anime.id in picked`. That is why
`cardCount` counts matching cards rather than all of a show's cards.

## Testing

Vitest is configured, so the gate is on.

- **Step 1** is in-scope logic and ships `deckFilterPreview.test.ts` (cases
  listed in the step).
- **Step 2** is a thin route over tested logic: `curl` evidence.
- **Step 3** is a UI refactor: build plus browser evidence on `/study`
  (screenshot of the popup with options loaded, plus the interactions listed).
  Existing `studyFilters.test.ts` must stay green.

## Notes for the AI

- Server: all SQL stays in `server/utils/`; the route only parses and calls.
  Reuse `studyFilterCondition` as is; it expects `anime` and `song` joined,
  which this query does.
- Don't duplicate the filter parser or condition for decks; if 77a seems to
  need a filter behaving differently from Study, stop and ask.
- Step 3 is a move, not a redesign: keep class names, markup order, and
  copy identical so the diff reads as relocation. Nuxt names
  `components/study/StudyFilterForm.vue` `<StudyFilterForm>`.
- The popup copy "only shows on someone's Completed list" and the "Study
  filters" title are Study wording; leave the title in the modal. 77b can
  pass its own title around the form.
- No em dashes, no inline styles, tokens only (`coding-standards.md`).
