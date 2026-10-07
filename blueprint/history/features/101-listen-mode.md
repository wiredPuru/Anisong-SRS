# Feature: Listen mode

**From build-plan:** feature 101
**Status:** verified

## Goal

A `/listen` page that plays the songs of a deck (or all cards, an artist, an
anime) one after another, in order or shuffled, with `/study`'s player, info
panel and display toggles but none of its grading. Nothing is scheduled,
scored or stored. It exists so a deck can be put together and then played for
friends as a casual guess-the-anime session, without the party server.

## In scope

- `POST /api/listen/queue`: resolves a scope plus filters into an ordered list
  of full cards (deck order or shuffled), reusing party mode's queue helpers.
- `/listen?type=all|artist|anime|created[&id=]`: same scope links as `/study`.
- Previous / Next through the playlist (buttons plus `ArrowLeft` / `ArrowRight`),
  a "N / total" position with a progress bar, a Shuffle toggle (default on), a
  "Playlist finished" screen with Play again.
- Study's display toggles: Hide Video (`v`), Hide Info (`i`), Hide Cover (`c`),
  Random start, Ambient mode, audio-only override. Hide Info is on by default.
- A per-card **Reveal** (button and `r`): lifts the Hide Video / Hide Cover /
  Hide Info veil for the current song only; the next song is veiled again.
- Auto Reveal (Video / Info / Both, seconds) using Study's existing popup and
  stored settings, counting down only while the clip plays and revealing that
  one song.
- Study's filter popup (`StudyFiltersModal`), kept separately from Study's own
  saved filters.
- Prefetching the next two clips, the way Study does.
- Entry points: "Listen" beside "Study this deck" and "Listen all" beside
  "Study all" on `/decks`, and a "Listen" link in the rail.

## Out of scope

- Pass/Fail, typed answers, score and combo, undo, bury, suspend, edit or
  delete a card, the session log, "N left" and new-card limits. Nothing is
  written: no `ReviewLog`, `Card` or `CardTrack` change.
- Auto-advance to the next song. Hands-free pacing belongs to party mode's
  lightning rounds (feature 86e); it can be a later item if wanted.
- A LAN door, phones, buzzers or scoring: that is feature 86/90.
- Refactoring `study/index.vue`. Listen gets its own small page and composable;
  the shared pieces are the existing components.
- Looping the playlist. It stops at the end with Play again.
- Dropping cards whose local file has gone missing: the player's own error
  state shows, with a Next button.

## Design reference

No new visual target. Match `/study`'s shipped Kai look: copy the minimal
header, `.study-grid` and player/side-panel CSS rules into the page's scoped
styles, using `var(--token)` values only. Do not extract or restyle Study's.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Queue route** - `server/api/listen/queue.post.ts` takes the
  existing `parsePartySource` body (`scope`, `filters`, `shuffle`; `downloadedOnly`
  is ignored), runs `listPartyCardIds` and `pickPartyQueue`, loads the cards with
  `getCardsByIds`, and returns them in the picked order through a pure
  `orderCardsByIds(ids, cards)` (`server/utils/listenQueue.ts`) that drops ids
  with no card. Returns `{ cards, total }` where `total` is the match count
  before the 2000 cap. Same 400s as party's queue preview for a bad body.
  *Done when:* a `curl` POST with `{ "scope": { "type": "all" }, "shuffle": false }`
  returns cards in anime-title then slot order; with `"shuffle": true` the order
  differs between calls; a created-deck scope returns only that deck's cards; a
  bad scope returns 400; `orderCardsByIds` has a passing Vitest covering order,
  a missing id, and duplicates.
- [x] **Step 2 - Playlist helpers** - `app/utils/listenQueue.ts`, pure:
  `isPlayableCard(card, clipSource)` (a local path, or a remote URL the Clip
  source setting allows, via `isRemoteUrlAllowed`), `stepIndex(index, total,
  direction)` returning the new index or `"finished"` past the last song and
  staying at 0 going back from the first, and `positionLabel(index, total)`
  (`"3 / 40"`). *Done when:* `listenQueue.test.ts` passes, covering the
  first/last/empty/one-card edges and each Clip source value.
- [x] **Step 3 - `useListenSession`** - `app/composables/useListenSession.ts`
  takes the scope, filters, shuffle and clip source refs, calls the queue route,
  drops unplayable cards (keeping a `skippedCount`), and exposes `currentCard`,
  `index`, `total`, `loading`, `error`, `finished`, `capped` (true when the route's
  `total` exceeded the cards returned), `next()`, `previous()`, `restart()` (a fresh fetch, so a
  shuffled list reshuffles) and `presentationKey` (bumped on every card shown,
  like Study's). It refetches when scope, filters or shuffle change, and warms
  the cache for the next two cards with `resolveRemotePrefetchUrl` and
  `POST /api/media/prefetch`. It never calls a study or review route. Declares
  its own client `CardWithDetails` import from `useStudySession` rather than a
  third copy. *Done when:* in a scratch page or the browser console the session
  steps through a real deck with Next/Previous, finishes after the last song,
  restarts, and the network panel shows only `/api/listen/queue`,
  `/api/media/prefetch` and media requests.
- [x] **Step 4 - Core `/listen` page** - `app/pages/listen/index.vue`: scope
  from the query exactly as `/study` parses it, the deck label via
  `/api/decks/cards` the way Study fetches it, then a header (scope chip,
  position label, progress bar, Shuffle toggle, Previous / Next buttons),
  `StudyMediaPlayer` and `StudyInfoPanel` (blurred), `ArrowLeft` / `ArrowRight`
  hotkeys through `useHotkeyGuard`, and the states: invalid scope, loading,
  load error, empty ("No songs match"), a "N songs skipped, no playable clip"
  note, a "showing the first 2000" note when capped, and "Playlist finished"
  with Play again. A card's player error state gets a Next button through the
  `#error-actions` slot. *Done when:* `/listen?type=created&id=<deck>` plays the
  deck's first song, Next and Previous move through it (Previous is disabled on
  the first song), the last Next shows the finished screen, Play again starts
  over, a bad `?type` shows the invalid-link state, and an empty deck shows the
  empty state. Screenshots at full width and under 820px.
- [x] **Step 5 - Toggles and Reveal** - Mount `StudyDisplayToggles` with a new
  optional `listen` prop that hides its Typed Answers control and, for now, the
  Auto Reveal control; wire Hide Video, Hide Info (default on), Hide Cover,
  Random start, Ambient mode and the audio-only override, with `v` `i` `c` `a`
  hotkeys matching Study's. Add `revealedThisCard`, reset whenever
  `presentationKey` changes, set by a Reveal button over the blurred panel and
  the `r` key. The player's `hide-video`, `hide-cover` and `hide-theme-badge`
  and the info panel's `blurred`/`inert` follow
  `(toggle on) && !revealedThisCard`. Ambient and Hide Info persistence follow
  Study's choices (ambient remembered, the rest session-only). *Done when:* with Hide Info on the title and artist stay
  blurred until Reveal or `r`, the next song is blurred again, Hide Video veils
  the picture until revealed, Random start jumps into the clip, and Study's own
  toggles row looks and behaves exactly as before (screenshot of `/study`).
- [x] **Step 6 - Auto Reveal** - Show the Auto Reveal control in listen mode.
  A small page-level timer (no change to `study/index.vue`) reads
  `gaqSrs:autoRevealMode` and `gaqSrs:autoRevealSeconds`, starts on the player's
  `playback-started`, pauses on `playback-paused` and resumes with the time
  left, and on expiry sets `revealedThisCard`. Video, Info and Both set which
  veils apply, using `canAutoReveal` and `remainingRevealSeconds` and showing
  `StudyAutoRevealCountdown`. A manual Reveal stops the pending timer. Changing
  mode or seconds on an already revealed song does not re-hide it. Never
  advances the playlist. *Done when:* with mode Both and 5 seconds, a song
  reveals about 5 playing seconds after it starts, pausing mid-count holds the
  countdown, an early Reveal cancels it, and the next song starts a fresh count.
- [x] **Step 7 - Filters and entry points** - Filters button with an "N filters
  active" badge opening `StudyFiltersModal` (title "Listen filters", a hint that
  it narrows the playlist), saved under `gaqSrs:listenFilters` and read during
  setup so the first fetch is already filtered, with an empty-state "Clear
  filters" action. Add "Listen" next to "Study this deck" and "Listen all" next
  to "Study all" on `/decks`, and a "Listen" rail link in `NavBar.vue`
  (`/listen`, plain `/listen` meaning all cards). *Done when:* a year or OP/ED
  filter narrows the playlist and survives a reload without touching `/study`'s
  filters, the three entry points open `/listen` with the right scope, and the
  rail marks Listen active on `/listen`. Final: `bun run test` and `bun run build`
  pass.

## Files / areas

- New: `server/api/listen/queue.post.ts`, `server/utils/listenQueue.ts` (+ test),
  `app/utils/listenQueue.ts` (+ test), `app/composables/useListenSession.ts`,
  `app/pages/listen/index.vue`.
- Changed: `app/components/study/StudyDisplayToggles.vue` (optional `listen`
  prop only), `app/pages/decks/index.vue` (two links), `app/components/nav/NavBar.vue`
  (one link).
- Reused unchanged: `StudyMediaPlayer`, `StudyInfoPanel`, `StudyFiltersModal`,
  `StudyAutoRevealCountdown`, `partySources.ts`, `getCardsByIds`.

## Data / contracts

No schema change and no migration.

**Load-bearing:**

```ts
// POST /api/listen/queue
// body:     { scope: StudyScope; filters?: string /* JSON, as /api/study/next */; shuffle?: boolean }
// response: { cards: CardWithDetails[]; total: number }   // cards capped at 2000
```

The `/listen` URL is `?type=all|artist|anime|created` plus `&id=` for the last
three, the same shape `/study` reads. The client `CardWithDetails` is the
existing one in `useStudySession.ts`; keep the server field order if the route
adds nothing new. localStorage: `gaqSrs:listenFilters` (new); the auto reveal
and ambient keys are shared with Study on purpose.

## Testing

`bun run test` is configured, so in-scope logic ships its test with its step:
`orderCardsByIds` (step 1) and the `listenQueue` helpers (step 2). The queue
route, composable, page, toggles and Auto Reveal timer are integration and UI,
verified in a real browser (`bun run dev`, plus `bun run measure /listen` for
the layout at narrow and wide widths) with screenshots, and the network panel
to confirm no `/api/study/*` call. If Auto Reveal's timer turns out to hold
branching worth asserting, pull that arithmetic into a pure util with a test
rather than testing the component. Run `bun run build` before the final step is
approved.

## Notes for the AI

- Listen must never write review state. Do not import or call `/api/study/review`,
  `/api/study/undo` or `useStudySession`'s `submit`; only the `CardWithDetails`
  type comes from there.
- Do not refactor `study/index.vue` or extract its auto-reveal code. The
  duplication is deliberate for this feature; note it in the final review packet
  as a candidate for a shared composable.
- `StudyMediaPlayer` is keyed by `presentationKey` and resolves `audioOnly` once
  before mount; never change `audioOnly` mid-playback (features 18 and 32 were
  abandoned over overlapping audio). Match Study's `playerAudioOnly` handling.
- Suspended cards and the Themes only setting are ignored by Listen, as in party
  mode: Listen plays what the deck holds.
- Study's hotkeys `s` (player) and `e` do not apply here; confirm `r` and `a`
  are free in `StudyMediaPlayer` before binding them.
- Conventions: `<script setup lang="ts">`, scoped CSS with tokens only, no inline
  styles, `useFetch`/`$fetch` with explicit loading and error states, no em
  dashes in any text.
