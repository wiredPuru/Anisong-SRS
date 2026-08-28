# Feature: Study session UI

**From build-plan:** feature 6b
**Status:** verified

## Goal

The headline feature's screen: pull the next due card for a chosen scope
(one artist deck, one anime deck, or all decks) via feature 6a's
`/api/study/next`, play its clip, show its title/artist info, and record
pass/fail via buttons or left/right arrow keys through
`/api/study/review` - looping to the next due card each time, with no
client- or server-side session state beyond what 6a already locked (each
`next` call is independently computed; there is no session id or stored
queue).

This spec was re-written fresh against the actual current codebase
(features 1-6a, verified by reading the real files, not the archived
specs or a prior draft of this same spec). An earlier in-progress attempt
at this feature existed on a different, now-discarded branch and never
reached `master`; nothing from it is assumed here.

## Design reference

`prototypes/study.html` (theme: `prototypes/theme.css`, already ported into
`nuxt-app/app/assets/css/main.css` - no porting step needed here). Build the
layout, spacing, and component look from this mockup, with the deviations
below - each one is forced by a decision 6a already locked or by a data
field that doesn't exist, not a style preference:

| Mockup shows | This spec does instead | Why |
|---|---|---|
| Lang toggles (EN/Romaji/JP+Furigana), JP ruby text, "Migaku can look up any word" hint | Fixed EN + Romaji title only, no toggle buttons, no JP line | Build-plan 6c owns toggles and furigana generation (new morphological-analyzer dependency); `CardWithDetails` doesn't carry `animeTitleNative` yet either (confirmed in `cards.ts`) - that's 6c's server work, not this feature's |
| "Card 4 / 12" progress bar with a known total | A plain running count, "Card N this session" (client-side counter, no denominator) | 6a deliberately has no session/queue concept - `next` is recomputed per call with no known total. A fake or fetched total would contradict that locked contract |
| Anime cover-art thumbnail + "CloverWorks · 2022" caption | No thumbnail block | Anime has no cover-art, studio, or year field in the data model; not adding schema this feature doesn't otherwise need |
| Box pill + "next review in 4 days" | Box pill only, no "next review" line | The shown card is due *now* by definition (that's why `next` returned it), so a forward-looking interval reads as wrong until after this review is submitted |
| "Kessoku Band" + "All decks" as two chips (implying a live in-session deck switcher) | One chip showing the current scope's label only | Feature list scopes a session at entry ("deck-scoped, or all decks"), not via a live switcher mid-session; switching means leaving and re-entering with a different scope |
| Native-style custom player skin (play button, scrub bar, time readout), veil overlay with "Listening..." for audio | Built as specified - custom transport (no native `controls`), veil shown for audio-only and whenever paused | No conflict; this is exactly what 6b needs to build (see Step 3) |
| Fail (←) / Pass (→) buttons | Built as specified | Confirms the arrow mapping; nothing in 6a or the data model contradicts it |

## In scope

- `GET /api/media?path=<absolute-path>` - server route that streams a local
  media file to the browser, with Range/206 support. Re-validates the path
  sits inside a configured media library folder before serving, since
  folders can change or files can be deleted after a card was created.
- A shared exported `isPathWithinLibrary` helper in `mediaLibrary.ts`, used
  by both the new route and `cards.ts`'s `validateLocalPath`, so the
  containment check isn't duplicated in two places.
- `useStudySession` composable: fetch the next due card for a scope via
  `GET /api/study/next`, submit a result via `POST /api/study/review`,
  advance to the next card, track "nothing due" and error states, count
  cards reviewed this page load, and reset cleanly if the scope itself
  changes underneath it.
- `/study` page: parses `?type=all|artist|anime&id=<n>` from the URL (same
  shape `StudyScope`/`/decks` already use), shows the current scope,
  renders the player + info panel + answer controls, loops via the
  composable.
- Custom video/audio player: derives quiz type per card (video if either
  video source is present, audio-only otherwise - matching the derivation
  already used for display in `cards/index.vue`'s `sourceBadges`), prefers
  local media over remote when a card has both, play/pause, click-to-seek
  scrub bar, elapsed/total time, resets cleanly when the card changes.
- Info panel: song title, EN + Romaji anime title, artist name, theme slot
  (OP1/ED2/etc.) badge, current box pill.
- Pass/Fail buttons plus left-arrow-fail / right-arrow-pass keyboard
  shortcuts, disabled while a review is in flight (no double-submit).
- "Study this deck" / "Study all decks" entry points added to `/decks`,
  since none exist yet (feature 5 explicitly deferred this to feature 6).
- Friendly handling for a malformed scope query (`type=artist` with no
  `id`, or a non-numeric `id`) instead of a crash.

## Out of scope

- Language display toggles, Japanese/furigana rendering - 6c, including the
  server-side `animeTitleNative` gap noted above.
- Any change to `Card`/`Song`/`Anime` schema (no cover art, studio, or year
  fields added).
- A real "session" construct (id, start/end, stored queue, fixed total) -
  stays exactly as stateless as 6a locked it.
- Guess-rate stats display - feature 7.
- Deck export/import - feature 8.
- Reworking `cards/index.vue` or `decks/index.vue`'s existing duplicated
  `CardWithDetails`/`extractErrorMessage` patterns into shared code - this
  feature follows the existing per-page convention rather than refactoring
  unrelated pages.
- The pending, uncommitted `project-plan.md` note about bulk artist import /
  video download - unrelated to this feature, still an open plan decision
  (see `project-overview.md`'s Open questions).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Local media serving route** - add
  `nuxt-app/server/api/media.get.ts` handling `GET /api/media?path=<absolute
  path>`: 400 if `path` is missing, 404 if the path doesn't exist on disk or
  isn't inside a configured library folder, otherwise streams the file with
  the correct `Content-Type` and range-request support. h3's `serveStatic`
  only handles etag/last-modified caching in this h3 version, not Range - so
  hand-roll Range parsing: `bytes=start-end` and the `bytes=-N` (last N
  bytes) suffix form, `fs.createReadStream(path, { start, end })` for the
  actual streamed slice via `sendStream`, `Accept-Ranges: bytes` on every
  response, `206` + `Content-Range: bytes start-end/size` when a valid
  Range is present, plain `200` with the whole file otherwise. Add an
  exported `isPathWithinLibrary(path: string): boolean` to
  `nuxt-app/server/utils/mediaLibrary.ts` and have `cards.ts`'s
  `validateLocalPath` call it instead of its own inline `relative()` check.
  *Done when*: with a real local media file path from the configured
  library, `curl -i 'localhost:3000/api/media?path=<that-path>'` returns
  `200` with a correct `Content-Type` and the file bytes; the same request
  with `-H 'Range: bytes=0-1023'` returns `206` with `Content-Range` set; a
  path outside any configured library folder returns `404`; a missing
  `path` param returns `400`; re-running feature 4's local-path curl checks
  (a card `PATCH` with a path outside the library still rejects with `400`)
  confirms the refactor didn't change `cards.ts`'s behavior; build +
  `tsc --build` clean.

- [x] **Step 2 - Study composable + minimal working loop** - add
  `nuxt-app/app/composables/useStudySession.ts` exporting a local
  `CardWithDetails`-shaped type (id, songId, localVideoPath,
  localAudioPath, animethemesVideoUrl, animethemesAudioUrl, box,
  nextReviewAt/createdAt as `string`, songTitle, themeSlot, artistName,
  animeTitleEnglish, animeTitleRomaji - mirrors the server type in
  `cards.ts` since dates arrive as ISO strings after JSON serialization,
  matching the pattern already used in `cards/index.vue`/`decks/index.vue`)
  and `useStudySession(scope: ComputedRef<StudyScope>)` returning
  `{ currentCard, loading, error, sessionComplete, reviewing,
  reviewedCount, submit }`. `submit(result)` guards against re-entry while
  `reviewing`, `POST`s to `/api/study/review`, and on success increments
  `reviewedCount` then re-fetches `/api/study/next` for the next card (or
  sets `sessionComplete` when it returns `card: null`); on failure it clears
  `reviewing` and sets `error` without advancing or incrementing the count,
  so a failed submit can be retried. Internally `watch`es the `scope` ref
  (`immediate: true`): whenever it changes, reset `reviewedCount` to `0`,
  clear `sessionComplete`/`error`, and re-fetch `/api/study/next` from
  scratch for the new scope - this matters because a browser back/forward
  between two different `/study?...` URLs is a client-side route change
  that keeps the page component (and composable instance) mounted, it does
  not remount the page. Add `nuxt-app/app/pages/study/index.vue`: parses
  `type`/`id` from `route.query` into a `StudyScope` (defaulting to
  `{type:"all"}` when `type` is absent), wires the composable, and renders
  - with no styling or player yet - the current card's
  `songTitle`/`artistName`/`box` as plain text plus two plain buttons that
  call `submit("pass")`/`submit("fail")`, or an "all caught up" message
  when `sessionComplete`. *Done when*: with a due card available,
  navigating to `localhost:3000/study?type=all` in the browser shows that
  card's title/artist/box; clicking the buttons submits a review, advances
  to the next due card, and updates the box shown; repeating until nothing
  is due shows the empty-state message; navigating to a scoped URL
  (`?type=artist&id=<n>`) only ever shows cards from that artist; using the
  browser's back button to return from one scoped study URL to a
  differently-scoped one (reached earlier in the same tab) shows that
  other scope's cards and resets the visible reviewed count; build +
  `tsc --build` clean.

- [x] **Step 3 - Custom media player** - add
  `nuxt-app/app/components/study/StudyMediaPlayer.vue`, props `card:
  Pick<CardWithDetails, "localVideoPath" | "localAudioPath" |
  "animethemesVideoUrl" | "animethemesAudioUrl" | "themeSlot">`. Derives
  quiz type (`video` if `localVideoPath || animethemesVideoUrl` is present,
  else `audio`) and src (local path routed through `/api/media?path=...`
  from Step 1, `encodeURIComponent`'d; remote URL used directly; local
  preferred over remote when both exist for the chosen kind). Renders a
  `<video>` (no native `controls`) for the video case or a hidden `<audio>`
  for the audio case, both driven by template refs; a veil overlay (per the
  mockup's `.veil`/`.listening-icon`) shown whenever not playing, and always
  for the audio case since there's nothing to show visually. The player
  never attempts autoplay - it always mounts paused (browser autoplay
  policies are inconsistent enough across browsers that relying on it would
  make verification flaky; the veil-when-paused state the mockup already
  shows by default is exactly this, not a loading state). A theme-slot
  badge (top-left, from `card.themeSlot`); and a custom control bar below -
  play/pause toggle button, a clickable/draggable scrub bar bound to
  `currentTime`/`duration` (seeking on click), and an elapsed/total time
  label (`m:ss / m:ss`). A missing/deleted local file surfaces as a small
  inline error message in the player (catch the media element's `error`
  event, or the `/api/media` 404) rather than a broken `<video>`/`<audio>`
  element or an uncaught exception. Replace the Step 2 page's plain-text
  stand-in with `<StudyMediaPlayer :key="currentCard.id" :card="currentCard"
  />` so the player fully remounts (and restarts) on every card change.
  *Done when*: in the browser, a card with local or remote video visibly
  plays with working play/pause and a scrub bar that seeks on click; a card
  with only audio shows the veil and plays sound with the same transport
  controls; advancing to the next card via Pass/Fail always starts that
  card's media from the beginning; pointing a card at a local path that no
  longer exists shows the inline error instead of a broken player; build +
  `tsc --build` clean.

- [x] **Step 4 - Styled info panel and answer controls** - add
  `nuxt-app/app/components/study/StudyInfoPanel.vue` (props: `songTitle`,
  `artistName`, `animeTitleEnglish`, `animeTitleRomaji`, `box`), styled per
  the mockup's `.info-card`/`.title-block`/`.meta-row` (EN title large,
  Romaji subtitle beneath it, artist name, a `Box N` pill using
  `--accent-secondary`) minus the thumbnail, JP line, lang toggles, and
  "next review" caption per the Design reference table above. Add
  `nuxt-app/app/components/study/StudyAnswerControls.vue` (props:
  `disabled: boolean`; emits `pass`, `fail`), styled per the mockup's
  `.answer-bar`/`.answer-btn` (`--fail`/`--pass` tokens, `←`/`→` key-hint
  badges), and attaches a `window` `keydown` listener on mount (removed on
  unmount) mapping `ArrowLeft` to `fail` and `ArrowRight` to `pass`, ignored
  while `disabled`. Wire both into the study page in place of the Step 2
  plain markup, passing `reviewing` as `disabled`. *Done when:* the info
  panel visually matches the mockup's typography/spacing (minus the noted
  omissions) for a real card; pressing the left/right arrow keys fires the
  same `submit` calls as clicking the buttons; rapidly pressing an arrow
  key or clicking a button twice in quick succession only submits one
  review (box advances exactly once, confirmed via the displayed box value
  or network tab); build + `tsc --build` clean.

- [x] **Step 5 - Deck-scoped entry points and edge cases** - add a "Study
  this deck" link (`to="/study?type={activeType}&id={selectedId}"`, shown
  only when a deck is selected) and a "Study all decks" link
  (`to="/study?type=all"`) to `nuxt-app/app/pages/decks/index.vue`, matching
  its existing `activeType`/`selectedId` computed refs. On the study page,
  when scoped, fetch the deck label via the existing `GET
  /api/decks/cards?type&id` (feature 5's endpoint - reuse it for its
  `deckLabel` field only, ignore `cards`) and show it in a scope chip
  (mockup's `.chip.active`); show `"All decks"` when `type=all`; show the
  Step 2 `reviewedCount` as a plain "Card N this session" label next to it
  (no progress bar, per the Design reference table). Handle a malformed
  scope query (`type=artist`/`type=anime` with a missing or non-numeric
  `id`) by rendering an inline "invalid study link" message instead of
  calling the API with bad params. *Done when:* from `/decks`, selecting an
  artist or anime deck and clicking "Study this deck" lands on a correctly
  scoped `/study` session showing that deck's label in the chip; "Study all
  decks" lands on an unscoped session; visiting
  `localhost:3000/study?type=artist` (no `id`) or
  `?type=artist&id=notanumber` shows the invalid-link message, not a crash
  or a 500; build + `tsc --build` clean.

## Files / areas

- `nuxt-app/server/api/media.get.ts` - new
- `nuxt-app/server/utils/mediaLibrary.ts` - add `isPathWithinLibrary`
- `nuxt-app/server/utils/cards.ts` - `validateLocalPath` reuses it
- `nuxt-app/app/composables/useStudySession.ts` - new
- `nuxt-app/app/pages/study/index.vue` - new
- `nuxt-app/app/components/study/StudyMediaPlayer.vue` - new
- `nuxt-app/app/components/study/StudyInfoPanel.vue` - new
- `nuxt-app/app/components/study/StudyAnswerControls.vue` - new
- `nuxt-app/app/pages/decks/index.vue` - add study entry-point links

## Data / contracts

No schema changes.

**Reused, unchanged (verified against the real code, not just archives):**

```ts
type StudyScope = { type: "all" } | { type: "artist"; id: number } | { type: "anime"; id: number };
```

- `GET /api/study/next?type=...&id=...` -> `{ card: CardWithDetails | null }`;
  `400` on a missing/invalid `type` or a missing/non-numeric `id` for
  `artist`/`anime`; `404` if that artist/anime id doesn't exist at all
  (confirmed in `study/next.get.ts` via `getArtistLabel`/`getAnimeLabel`).
- `POST /api/study/review` body `{ cardId: number, result: "pass" | "fail" }`
  -> `200 { card: CardWithDetails }`; `400` on bad input; `404` if `cardId`
  doesn't exist (confirmed in `study/review.post.ts` via `recordReview`).
- `GET /api/decks/cards?type=artist|anime&id=<n>` -> `{ deckLabel: string,
  cards: CardWithDetails[] }`; `400`/`404` on bad or missing id (confirmed
  in `decks/cards.get.ts`) - Step 5 reuses this only for `deckLabel`.

**New server contract:**

```
GET /api/media?path=<absolute local path>
  200 -> file bytes, correct Content-Type
  206 -> partial content when a Range header is sent
  400 -> missing `path`
  404 -> path doesn't exist, or isn't inside a configured library folder
```

**Client-side `CardWithDetails` mirror** (in `useStudySession.ts`, the
canonical import point for the study components, same as `cards/index.vue`
and `decks/index.vue` each keep their own local copy rather than a shared
`app/types/` file):

```ts
interface CardWithDetails {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  box: number;
  nextReviewAt: string;
  createdAt: string;
  songTitle: string;
  themeSlot: string;
  artistName: string;
  animeTitleEnglish: string;
  animeTitleRomaji: string;
}
```

## Testing

Still no test runner configured (`AGENTS.md` Commands section has none), so
this rides on the browser/curl evidence in each step's *Done when*, per the
project's testing gate. `study.ts`'s `computeNextBoxState` (feature 6a) was
already flagged as the strongest unit-test candidate the project has had -
if `/tests` runs before this feature, that's the one to backfill first, not
anything new here. Two pure-logic candidates from this feature would be
worth covering if a runner existed: the quiz-type/src derivation in
`StudyMediaPlayer` (given a card's four media fields, which kind and which
src) and the scope-parsing in `study/index.vue` (query -> `StudyScope` or
invalid) - both are extractable, deterministic, easy to enumerate edge
cases for. Not testable now; no runner exists.

## Notes for the AI

- The hardest correctness risk here is Step 1: never trust a stored
  `localVideoPath`/`localAudioPath` blindly at serve time even though it
  was already validated at card-create time - library folders can be
  reconfigured or files deleted afterward, so re-check containment on every
  request. This is exactly why `isPathWithinLibrary` gets called fresh in
  the new route, not cached from creation time.
- `nextReviewAt`/`createdAt` are `Date` objects server-side (confirmed:
  `cards.ts`'s `CardWithDetails.nextReviewAt` is typed `Date`) but arrive in
  the browser as ISO strings after JSON serialization - type them `string`
  client-side, matching how `cards/index.vue` and `decks/index.vue` already
  do it.
- This is the first feature to use `app/composables/` and
  `app/components/` - neither directory exists yet on `master`, even though
  `coding-standards.md` already names them as the convention. Using them
  here is adopting the documented convention, not introducing a new one.
- A missing/deleted local media file should degrade to a visible error in
  the player, not crash the page or the review loop, per the Error Handling
  standard - if `/api/media` 404s, catch it in `StudyMediaPlayer` and show a
  small inline message rather than a broken `<video>`/`<audio>` element.
- Reuse `getArtistLabel`/`getAnimeLabel` (confirmed exported from
  `decks.ts`) only where they already fit (`/api/decks/cards`'s existing
  404 behavior already covers the deck-existence check); don't duplicate a
  new existence check in the study page just to validate a deck id before
  showing the chip - a `404` from that call is itself the "invalid deck"
  signal, same pattern `study/next.get.ts` already established.
- No dynamic route segments anywhere in this codebase (confirmed) - stay
  with query-string parameters for `/study`, consistent with
  `/decks`/`/cards`.
- The composable must watch the `scope` param and reset/refetch on change
  (see Step 2) - added during this re-spec's red-team pass. A prior draft
  of this spec didn't call this out explicitly, and it's the one realistic
  way `/study`'s page component stays mounted across a scope change
  (browser back/forward between two `/study?...` URLs), so skipping it
  would leave a stale `reviewedCount` or the wrong deck's card on screen.
