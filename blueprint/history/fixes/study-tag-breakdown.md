# Current Feature

## Tag breakdown in Study filters

**Type:** Fix

**Status:** verified

### The problem

The Tags section of Study's Filters popup (`app/components/study/StudyFiltersModal.vue`,
feature 76b) is search-only. With an empty search box it shows the 12 most common
tags, and every other tag stays hidden until you already know its name and type it.
So there is no way to see which tags your library actually shares.

The counts next to those tags are also misleading. `getStudyFilterOptions`
(`server/utils/studyFilterOptions.ts`) counts a show under a tag at any relevance.
The filter itself only matches a tag at or above the "Tag must be at least N%
relevant" slider (default 60%). A tag can show "3" and still match 0 shows.

### The fix

Show a browsable breakdown of every tag that **2 or more shows** in the library have,
each with its show count, counted at the current relevance setting.

- **Server:** each entry in `StudyFilterOptions.tags` carries its per-show relevance
  ranks instead of a plain count: `{ name: string; ranks: number[] }`, one rank per
  show with cards that has the tag. Still one query, still limited to anime that have
  cards. The client copy of the shape in `StudyFiltersModal.vue` is updated to match.
- **Pure helper** in `app/utils/studyFilters.ts`:
  `tagBreakdown(tags, minRank, chosen)` returns `{ name, count }[]`, where `count` is
  the number of ranks at or above `minRank`. It drops tags already chosen and tags with
  `count < 2`, and sorts by count (highest first), then by name.
- **Modal:** with the search box empty, the Tags section lists the full breakdown as
  tappable pills (`name` plus count, tap to require: the existing `addTag`) in a
  height-capped, scrollable container, so a long list does not push Apply off-screen.
  Typing still searches **all** tags, including single-show ones, so rare tags stay
  reachable. Search-result counts use the same relevance-aware count. Counts update
  live as the relevance slider moves.
- If nothing reaches 2 shows, a short hint says so ("No tag is shared by 2+ shows at
  this relevance"), instead of an empty space.

Must not change: how filtering works (`studyFilterCondition`), the saved filter shape
(`gaqSrs:studyFilters`), the require/exclude chips, or the Genres section.

Note: your library has no anime details fetched yet (Settings → Media library → Anime
details → Fetch missing details), so the breakdown will be empty until that runs.

### Build steps

1. [x] **Relevance-aware tag options.** Return `ranks` per tag from
   `getStudyFilterOptions`, add `tagBreakdown` to `app/utils/studyFilters.ts`, and
   update `studyFilterOptions.test.ts` plus a new `tagBreakdown` test. Cover: the 2+
   threshold, a rank below `minRank` not counting, chosen tags removed, and sort
   order.
   **Done when:** `bun run test` passes and `GET /api/study/filter-options` returns
   `ranks` arrays.
2. [x] **Breakdown in the Filters popup.** Replace the empty-search top-12 list with
   the scrollable breakdown. Keep search across all tags. Wire the counts to
   `draft.tagMinRank`.
   **Done when:** with anime details fetched, opening Filters shows every tag shared by
   2+ shows with correct counts. Moving the slider changes the counts and drops tags
   that fall below 2. Tapping one adds a `+` chip. Searching still finds a
   single-show tag.

### Verify

- `bun run test` and `bun run build` pass.
- Run **Fetch missing details** in Settings, then open Study → Filters. Compare a few
  tag counts against the database, e.g.
  `sqlite3 .data/gaq-srs.db "select count(*) from anime a where exists (select 1 from json_each(a.tags) where json_extract(value,'$.name')='<Tag>' and json_extract(value,'$.rank')>=60) and a.id in (select anime_id from song join card on card.song_id=song.id)"`.
- Require a tag from the breakdown, Apply, and confirm "N left" drops to a
  plausible number instead of 0.
