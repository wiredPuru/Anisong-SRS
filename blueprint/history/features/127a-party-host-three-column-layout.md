# Feature: Party host three-column layout

**From build-plan:** feature 127a (parent 127, Party host three-column revamp)
**Status:** verified
**Branch:** `feature/127a-party-host-three-column`

## Goal

Rearrange `/party/host` so each column has one job, as in the reference: the
left column runs the songs (up next, queue, transport), the middle column is
the scoreboard, and the right column shows the current song's answer and
details to the host. Today the columns mix these jobs: queue on the left, Now
playing plus scoreboard in the middle, a settings tab strip on the right. This
step moves existing pieces only; 127b adds More options and pins and replaces
the tab strip.

## Design reference

- `blueprint/reference/party-host-revamp/layout-main.png` - the target column
  arrangement (left: Up next, queue, controls, transport; middle: scoreboard
  with -1/+1/+2/+3; right: cover, theme, artists, titles, facts).
- `blueprint/reference/party-host-revamp/layout-more-options.png` - 127b only.

Match the arrangement, not the look: use the app's own `main.css` tokens
(Kai light/dark themes, outlined panels), never the reference's colors or type.
Leave out anything that has no backend here: Submitted Answers, Question,
Session history, Themes/More tabs, MAL score, member counts, play counts.

## In scope

- **Right column, song info:** a new `PartySongInfo` panel showing, for the
  current song: cover, Hidden/Revealed chip, lightning chip, theme slot label
  and Video/Audio, song title, artist, English, Romaji and Native titles (each
  only when different from the one above), then the facts the host state
  already carries (season and year, format, AniList score, studios, tags). The
  existing settings tab strip (Round, Screen, Players, New game) moves below it
  in the same column, unchanged, so every panel stays reachable.
- **Middle column, scoreboard:** the buzz judge strip (X buzzed in, Correct,
  Wrong, buzz log) and the post-reveal award strip move out of
  `PartyNowPlaying` into a new `PartyRoundJudge` above the scoreboard. The
  scoreboard becomes the main surface (fills the column, larger rows), its
  steps read -1 / +1 / +2 / +3 (adding +3). Rules stay below it.
- **Left column, songs:** "Add songs" (collapsible, open when no game), the
  queue list filling the middle (its existing Up next box, with Reroll and
  per-song effects, is the column's Up next), and `PartyNowPlaying`'s remaining
  transport (song count, stuck-clip notice, progress bar, previous / play-pause
  / next / skip to end, volume, the option toggles, End game) pinned at the
  bottom.
- **Narrow windows:** below 1100px the columns stack in the order transport,
  song info, judge + scoreboard, queue, settings, so a phone host still has
  Play and Reveal first.
- Every existing `data-palette-target` keeps working, so the Shift+P command
  bar and the 1-4 tab hotkeys still jump to the right place.

## Out of scope

- More options pop-up, Edit pins, the pinned-controls grid, and removing the
  tab strip (127b).
- Any server, reducer, route, or state shape change. No genres on the host
  (not in `PartyHostState`; adding them is a server change).
- The display (`/party/display`) and the player page (`/party/play`).
- New controls the reference has without a backend here (listed above).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Song info helpers + `PartySongInfo`** - a pure
  `app/utils/partySongInfo.ts` with `songInfoRows(facts)` (labelled fact rows,
  empties dropped, season and year as "Spring 2022", score as "71%"), with
  tests; season/year formatting is shared with the display through
  `seasonYearLabel` in `partyRevealFacts.ts`. `PartySongInfo.vue` renders the cover, chips, titles and rows
  for the current song and replaces the answer block inside
  `PartyNowPlaying` for now, so nothing moves columns yet.
  *Done when:* `bun run test` passes the new tests, and with a game loaded the
  host shows the same answer as before plus the fact rows (a show with no
  studios or score shows no empty rows).
- [x] **Step 2 - `PartyRoundJudge`** - move the buzz judge strip, buzz log, and
  award strip out of `PartyNowPlaying` into `PartyRoundJudge.vue`, mounted
  directly above the scoreboard. Same commands (`buzzJudge`, `award`).
  *Done when:* with buzzer mode on, a phone buzz shows Correct / Wrong above
  the scoreboard and both work; after a reveal, tapping a player awards and
  un-awards; `PartyNowPlaying` no longer renders either strip.
- [x] **Step 3 - Re-grid the dashboard** - `PartyHostDashboard` lays out
  left (collapsible Add songs, queue with its Up next box, transport pinned at
  the bottom),
  middle (judge, scoreboard filling the column, rules), right (`PartySongInfo`
  at the top, settings tabs below, scrolling on its own). Breakpoints updated
  for the stacking order above; the 3000px wide rule kept.
  *Done when:* at 1920x1080 the page has no page scroll, each column scrolls
  on its own, and the three columns match the reference's arrangement; at
  1000px wide the order is transport, song info, scoreboard, queue, settings;
  Shift+P picks for Effects, Scoreboard, Add songs and New game each scroll to
  and flash their target; the 1-4 hotkeys switch tabs.
- [x] **Step 4 - Scoreboard as the main surface** - steps read -1 / +1 / +2 /
  +3 (new `adjust` delta 3), rows larger with the score set apart from the
  name, add-player field at the bottom as in the reference. Kick, ban, rename,
  teams and reset unchanged.
  *Done when:* +3 adds three points on host and display; -1 still takes one;
  a 20-player board scrolls inside the middle column without pushing the page.

## As built

- The grid is `minmax(270px, 400px) minmax(460px, 1fr) minmax(290px, 440px)`,
  so the scoreboard keeps at least 460px down to 1101px wide (with `minmax(0,
  1fr)` the side columns took their maximums first and left it 189px). The
  1400px two-column fallback was removed.
- The queue column scrolls as a whole when the window is too short for a
  300px queue panel plus the transport, instead of clipping the transport.
- `PartyQueueList` fills its panel (no 290px cap) and its header wraps, which
  also fixes "Shuffle upcoming" being cut off beside "Export played CSV".
- No separate Up next line: the queue list's existing Up next box is the
  column's Up next.

## Files / areas

- New: `app/utils/partySongInfo.ts` (+ `.test.ts`),
  `app/components/party/PartySongInfo.vue`,
  `app/components/party/PartyRoundJudge.vue`.
- Changed: `app/components/party/PartyHostDashboard.vue` (grid, Add
  songs collapse), `utils/partyRevealFacts.ts` (exports `seasonYearLabel`), `PartyNowPlaying.vue` (loses answer, judge and award
  blocks), `PartyScoreboardPanel.vue` (+3, row styling).
- Test fixture: `app/utils/testing/partyHostState.ts` if the helpers need a
  host state builder.

## Data / contracts

- No change. Reads the existing client copy of `PartyHostState`
  (`usePartyHost`): `queue[].answer` (`PartyAnswer` with `facts:
  PartyAnswerFacts { year, season, format, studios, averageScore, tags }`),
  `index`, `phase`, `lightning`, `buzz`, `currentAwards`, `scoreboard`.
- Sends only existing commands; the one new value is `score adjust` with
  `delta: 3`, which `parsePartyCommand` already accepts (any whole number).

## Testing

- Vitest (gate on): `songInfoRows` (all fields, missing season or year,
  null score, empty studios and tags, rows order) in `partySongInfo.test.ts`;
  `revealFactLine` tests still cover the shared `seasonYearLabel`.
- Components and layout ride on browser evidence: `bun run build`, then
  `bun run party`, log in to the host, load a game, and screenshot at
  1920x1080 and 1000x900 (`playwright-cli` or `bun run measure` against the
  host door) to prove the column arrangement and no page scroll.
- `bun run test` and `bun run build` green before each checkpoint.

## Notes for the AI

- Client only. Components call `send(command)` through the existing
  `@command` emits; never `$fetch` party routes directly from new components.
- Keep the answer host-only: `PartySongInfo` lives on the host page
  and read host state; nothing changes what the display receives.
- Scoped `<style>` with `var(--token)` only; reuse the dashboard's `.panel`,
  `.panel-title`, `.tbtn`, `.link-btn` classes rather than new look-alikes.
- Keep every `data-palette-target` attribute on the element it targets today
  when moving markup, and keep `PartyQueueBuilder` mounted with `v-show` (a
  half-built game must survive a tab switch).
- Slot labels go through `formatThemeSlotLabel` so inserts read "Insert".
- No em dashes in code, comments or copy.
