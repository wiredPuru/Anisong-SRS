# Feature: Artist search + categorized results in global search

**From build-plan:** feature 47
**Status:** verified

## Goal

The nav bar's global search currently only matches existing local cards by
song title, with a live AniList anime fallback that's hidden unless that
local match is empty. Typing an artist's name finds nothing local and
misleadingly falls through to "Add a show." This feature adds a live
`Artists` search category (animethemes.moe) and turns today's "Add a show"
into an always-shown `Anime` category, so the dropdown reads as three
parallel groups - Cards, Artists, Anime - covering what you already have and
what you could add, by any of the three things you might type.

## In scope

- A new `Artists` group in the nav search dropdown, backed by the existing
  `GET /api/lookup/artist-search` (animethemes.moe) - the same endpoint
  `/cards/new`'s "By artist" tab already calls.
- Clicking an Artist result navigates to `/cards/new?artistSlug=<slug>`,
  which resolves that artist's full catalog immediately (no extra "Select"
  click), reusing the existing `selectArtist`/`artist-import` flow as-is.
- Relabeling today's "Add a show" group to `Anime` and removing its
  `results.cards.length === 0` gate, so it fires alongside the other two
  groups on every 2+ character query instead of only when Cards is empty.
- Restructuring the dropdown's three fetches (Cards, Artists, Anime) to run
  concurrently, each rendering/erroring independently instead of Cards
  blocking the other two.
- The `Cards` group's own matching, ordering, and Preview-click behavior -
  entirely untouched.

## Out of scope

- Any change to `GET /api/search` or `server/utils/cards.ts` - the local
  `Cards` group's server logic is not touched.
- Broadening local `Cards` matching to also match artist name or anime
  title (still song-title-only, exactly as today).
- A live artist fallback being limited to "only when nothing local
  matches" - deliberately unconditional per the approved design, matching
  how the Anime group also becomes unconditional.
- Any dedup between the `Anime` group and cards you already have for that
  anime - matches today's existing (pre-this-feature) behavior for the
  AniList fallback, just no longer gated.
- Any change to `/cards/new`'s existing `?aniListId=` or `?q=` deep links
  beyond adding the new `?artistSlug=` one alongside them.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - NavBar: un-gate + relabel the Anime group to run
  concurrently with Cards** - In `nuxt-app/app/components/nav/NavBar.vue`:
  - Restructure `runSearch()` so the local `/api/search` call and the
    `/api/lookup/anilist-search` call fire concurrently once the query is
    2+ characters (today the AniList call only starts after the local
    call resolves and finds nothing) - each keeps its own pending/result
    state, each independently guarded by the existing `searchGeneration`
    staleness check (a fast second keystroke must not let a slow
    first-keystroke response overwrite newer results in either group).
  - Drop the `results.cards.length === 0` gate on the AniList fetch - it
    now always runs alongside `Cards`.
  - Rename the "Add a show" group label to `Anime` (the `addShow` handler
    and its `/cards/new?aniListId=<id>` navigation are unchanged).
  - Update the no-results computed logic so "No results" only shows once
    both fetches have settled and both are empty, and each group's own
    "Searching..." state no longer blocks the other from rendering.
  *Done when:* typing any 2+ character query shows an `Anime` group of
  AniList matches regardless of whether `Cards` also has local matches for
  the same show (today it only appears when `Cards` is empty); typing an
  existing card's song title still shows the unchanged `Cards` group;
  clicking an Anime result still navigates to `/cards/new?aniListId=<id>`;
  `bun run build` is clean.

- [x] **Step 2 - NavBar: add the live Artists group** - In the same file,
  building on Step 1's concurrent-fetch structure:
  - Add a local `ArtistCandidate` interface (`{ id: number; name: string;
    slug: string }`, mirroring the server's `AnimeThemesArtistCandidate`)
    and an `externalArtists` ref + `externalArtistsPending` ref, fetched
    from `/api/lookup/artist-search` concurrently with the other two,
    under the same `searchGeneration` guard.
  - Add an `Artists` group rendering `externalArtists`, styled like the
    existing groups (one full-width `<button>` per result, artist name as
    the label). Add a `selectArtistResult(candidate)` handler that resets
    the search and navigates to `/cards/new?artistSlug=<candidate.slug>`.
  - Extend `resetSearch()` to also clear `externalArtists`/
    `externalArtistsPending`, so picking a `Cards` result doesn't leave a
    stale `Artists` group behind the next time the dropdown opens.
  - Extend the "No results" computed logic to include this third group.
  - Swallow errors from both external fetches into that group being empty
    (no separate error banner), matching the existing AniList fallback's
    established behavior; the local `Cards` fetch keeps its existing
    dedicated `searchError` banner, since it's the primary call.
  - Update the input placeholder to reflect the broadened scope (e.g.
    "Search Anime or Artist").
  *Done when:* typing an artist name (in the library or not) shows an
  `Artists` group; clicking a result navigates to
  `/cards/new?artistSlug=<slug>`; selecting a `Cards` result and reopening
  the dropdown on a fresh query shows no leftover `Artists` rows from the
  previous search; `bun run build` is clean.

- [x] **Step 3 - `/cards/new`: handle the `?artistSlug=` deep link** - In
  `nuxt-app/app/pages/cards/new.vue`'s existing `onMounted`, add a third
  check (after the existing `aniListId` check, before the `q` check) for
  `route.query.artistSlug`: if present, set `searchMode.value = "artist"`
  and call the existing `selectArtist()` with a placeholder candidate
  (`{ id: 0, name: "", slug: artistSlugValue }`) - mirroring exactly how
  the `aniListId` branch already calls `selectAnime()` with placeholder
  title fields it doesn't need. `artistSlug` and `q`/`aniListId` are
  mutually exclusive in practice; if more than one is somehow present,
  `aniListId` wins first (existing precedence), then `artistSlug`, then `q`.
  *Done when:* visiting `/cards/new?artistSlug=<slug>` lands on the "By
  artist" tab with that artist's full catalog already resolved and shown -
  no manual "Select" click needed; `?aniListId=` and `?q=` deep links keep
  behaving exactly as before; `bun run build` is clean.

## Files / areas

- `nuxt-app/app/components/nav/NavBar.vue` - the dropdown, its three
  fetches, and the new Artists group.
- `nuxt-app/app/pages/cards/new.vue` - the new `artistSlug` deep-link
  handler in `onMounted`.

## Data / contracts

No new server routes, no schema changes. Reuses two existing endpoints
as-is:

- `GET /api/lookup/artist-search?q=<query>` -> `{ results:
  { id: number; name: string; slug: string }[] }` (already used by
  `/cards/new`'s "By artist" tab).
- `GET /api/lookup/anilist-search?q=<query>` -> `{ results: { aniListId:
  number; titleRomaji: string; titleEnglish: string | null; titleNative:
  string | null }[] }` (already used by today's "Add a show").

New URL query param on `/cards/new`, alongside the existing `aniListId` and
`q`:

- `artistSlug` (string) - when present, selects the "By artist" tab and
  resolves that artist's catalog immediately via the existing
  `selectArtist`/`POST /api/lookup/artist-import` flow.

## Testing

No test runner logic is introduced - this is UI/integration wiring over
two already-tested, unchanged server endpoints. Verify by browser/build
evidence, per the Testing gate in `coding-standards.md`:

- `bun run build` clean after each step.
- `bun run test` still passes (regression check; nothing here touches
  `study.ts`).
- Manual: type an artist name that already exists on animethemes.moe but
  has no local cards -> `Artists` group shows it, no `Cards`/`Anime`
  matches required; click it -> lands on `/cards/new` with that artist's
  catalog already expanded. Type an anime title -> `Anime` group shows
  AniList matches even when `Cards` also has local matches for the same
  show. Type an existing card's song title -> `Cards` group is unchanged
  from today. Type a nonsense query -> all three groups empty, "No
  results" shown once, not per group.

## Notes for the AI

- Keep the `Cards` group's fetch, ordering, and `selectCard`/Preview-modal
  handoff completely untouched - only the surrounding dropdown structure
  and the two external groups change.
- The existing `searchGeneration` counter already guards the local fetch
  and the old AniList fallback against stale/out-of-order responses from a
  fast typist; extend the same guard to the new artist fetch rather than
  inventing a second mechanism.
- `ArtistCandidate.id`/`.name` are not read inside `selectArtist()` (only
  `.slug` is sent to the server) - the placeholder `{ id: 0, name: "" }` in
  Step 3 is safe for the same reason the existing `aniListId` deep link's
  placeholder `titleRomaji: ""` etc. are safe today.
- Match existing conventions: `$fetch` for these read-only lookups (already
  the pattern both reused endpoints use elsewhere), scoped `<style>` with
  `var(--token)` for the new `Artists` group's markup (copy the existing
  `.search-group`/`.search-result` classes - no new CSS needed).

## Build notes

Built via `/implement` on `feature/global-search-artist-categories`, all
three steps approved with "Continue" at each checkpoint (no intermediate
commits). No new server routes or schema changes - both new groups reuse
endpoints already exercised elsewhere in the app (`/cards/new`'s "By
artist" tab and the pre-existing "Add a show" AniList fallback). Verified
via `bun run build` (clean at every step) and dev-server + curl evidence
against all three underlying endpoints and the full artist-resolve chain;
no Playwright in this project, so the live dropdown interaction itself
was not driven in a browser - same verification standard the earlier
`narrow-global-search-to-cards` fix used for this same component.

Immediately after this feature shipped, a bug was reported: navigating to
a second `?artistSlug=`/`?aniListId=`/`?q=` deep link while already on
`/cards/new` updates the URL but doesn't re-resolve, because the
`onMounted` handler this feature's Step 3 added (mirroring the pre-existing
`aniListId` pattern) only fires once per page mount, not on every
same-route query change. Tracked as a separate `/fix`, not folded back into
this archive.
