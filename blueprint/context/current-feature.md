# Feature: Host command bar

**From build-plan:** feature 108
**Status:** in progress

## Goal

Give the party host a VS Code style command palette on `/party/host`. Press
Cmd+P (Ctrl+P on Windows/Linux), type a few letters such as "pixel" or "add
songs", and press Enter (or click). A toggle flips and the page scrolls to its
control with a highlight. A one-shot action runs. A panel is jumped to, with
its first field focused. The host panel has grown to four tabs and about fifteen
panels, and hunting for one control mid-game is slow. A searchable entry point
fixes that without changing the layout.

## In scope

- **Open and close.**
  - Cmd+P on macOS and Ctrl+P elsewhere opens the bar. It overrides the
    browser's Print shortcut on this page only.
  - The shortcut works even while a text field has focus, the way VS Code's
    does.
  - Pressing it again, Esc, or a backdrop click closes the bar, and focus
    returns to where it was.
  - A "Commands (⌘P)" / "Commands (Ctrl+P)" button in the dashboard header
    opens it too, so the feature is discoverable.
  - The shortcut is listed in the `?` help.
- **Search.**
  - A text box plus a result list.
  - Matching is case-insensitive and forgives partial words, out-of-order
    words, and one typo per word of 4+ letters ("pixlate" finds Pixelate).
  - Each command has keywords, so "add show" and "queue" both reach Add songs.
  - Results are ranked: exact or prefix match first, then word-prefix, then
    subsequence or typo matches.
  - At most 12 results are shown.
- **Picking.**
  - Up/Down move the highlight (wrapping), Enter runs it, the mouse hovers and
    clicks.
  - The highlighted row stays scrolled into view.
  - The list is a proper `listbox` with `aria-activedescendant` on the input.
- **Result rows.**
  - Each row shows a title, a group label (Playback, Screen, Round, Players,
    Show, Game, Panels), the state chip On / Off for toggles, and the hotkey
    (`X`, `Space`, ...) when one exists.
  - A command that needs a running game is shown disabled, with the reason
    "Start a game first". Picking it does nothing.
- **Behaviour by kind.**

  | Kind | What happens | Bar after |
  | --- | --- | --- |
  | Toggle | Sends the same command its button or hotkey sends, then jumps to its control and highlights it | Closes |
  | Action | Sends the command | Closes |
  | Jump | Switches to the owning tab if needed, scrolls the target to the centre, highlights it about 1.2s, and focuses its first text field if it has one | Closes |

- **Recent picks.**
  - The last 5 distinct command ids are stored in `localStorage`
    (`gaqSrs:partyPaletteRecent`), newest first.
  - They are listed under a "Recent" heading when the box is empty.
  - Any remaining room is filled with the default list, in registry order.
  - Storage can fail; the bar still works without recents.
- **Commands in the first version:**

  | Group | Commands |
  | --- | --- |
  | Playback | Play / pause (Space), Reveal (R), Next song (N), Previous song (P), Skip to end (E), Start 15s timer (T) |
  | Screen | Pixelate (X), Blur (B), Mute (M), Hide picture (V), Censor whole screen / lift (C) |
  | Players | Show scoreboard (S), Buzzer mode, Show join info on screen |
  | Round | Random start, Go to the next song when one ends, Show results |
  | Show | Lobby music |
  | Game | Shortcuts list (?), Ambient glow |
  | Panels (jump) | Add songs (keywords: add show, search, queue a song), Queue, Now playing, Preview and censor, Scoreboard, Rules, Lightning round, Help this song, Effects, Show on reveal, Show (timer, banner, music), Players join at, Connect a display or phone, New game, Endless playlist |

## Out of scope

- Player names as results ("Aki" jumps to their row): deferred, as agreed at
  intake.
- Commands that need an argument typed into the bar (`timer 30`, a banner text,
  set pixelate to level 3). Toggles use the same fixed values the hotkeys use.
  The jump lands on the control for anything finer.
- Effects on the "Next song" target. Toggles act on This song, like the
  hotkeys.
- Rebinding the shortcut, or a palette on `/party/display` or `/party/play`.
- Any server route, party command, or `PartyGameState` change.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Fuzzy matcher** - `app/utils/fuzzyMatch.ts`. The pure
  function `fuzzyScore(query, title, keywords)` returns a number, or null for
  no match.
  - Matching normalizes with NFKC, lowercases, and splits on non-letters.
  - Every query word must match some word of the title or a keyword. Allowed
    matches are prefix, substring, subsequence, or a Damerau-Levenshtein
    distance of 1 or less for query words of 4+ letters.
  - Tiers rank whole-title prefix > word prefix > substring > subsequence >
    typo, with a small bonus for a title match over a keyword match.
  - `rankCommands(query, commands, limit)` sorts by score, then registry order.
    An empty query returns null scores, and the caller handles that.
  - *Done when:* `fuzzyMatch.test.ts` passes. It covers "pixel", "pixlate",
    "PIXELATE", "add songs" vs "add show" via keywords, out-of-order words, a
    3-letter typo rejected, empty and whitespace-only queries, and stable order
    on ties.
- [ ] **Step 2 - Shared host actions** - move the command-building out of
  `usePartyHotkeys.ts` into the pure `app/utils/partyHostActions.ts`.
  - It exports `HOST_ACTIONS`: `{ id, label, keys, needsGame, build(state, ctx)
    }` for play/pause, reveal, next, previous, skip, mute, blur, pixelate,
    picture, censor, timer, and scoreboard.
  - `ctx` carries `lastHidingPicture` and `previewLead`.
  - `usePartyHotkeys` maps a key to an action id and calls `build`. Its
    observable behaviour is unchanged.
  - `PARTY_HOTKEYS` (the `?` help list) keeps its rows. It gains "Ctrl/⌘+P -
    Command bar".
  - *Done when:* `partyHostActions.test.ts` covers each action's command from a
    sample state. Examples: pixelate 0 -> 24 -> 0, needs-game actions return
    null without a game, and the scoreboard toggles `visible`. The existing
    party tests still pass, and every hotkey works in the browser as before.
- [ ] **Step 3 - Command registry + recents** - `app/utils/partyPalette.ts`.
  - `PartyPaletteCommand { id, title, group, keywords, kind:
    "toggle"|"action"|"jump", hotkey?, target?: PaletteTarget, tab?: HostTab,
    state?(host): boolean, available?(host): string | null, run?(host, ctx):
    PartyHostCommand | null }`.
  - It builds the table above. Hotkey commands reuse `HOST_ACTIONS`, and the
    panel toggles build the same commands their checkboxes send (`settings`,
    `autoAdvance`, `buzzer`, `joinInfo`, `summary`, `music`).
  - "Shortcuts list" and "Ambient glow" are local (no server command), handled
    through a `local` callback id.
  - `parseRecent` / `pushRecent` live in `app/utils/partyPaletteRecent.ts`:
    dedupe, cap at 5, drop ids no longer in the registry, and tolerate bad
    JSON.
  - *Done when:* `partyPalette.test.ts` checks the following, and
    `partyPaletteRecent.test.ts` covers parse and push.
    - Every command id is unique and every jump has a target.
    - Toggles report the right On/Off from a sample state.
    - "Start a game first" is returned only when there is no game.
    - Pixelate's `run` equals `HOST_ACTIONS` pixelate.
- [ ] **Step 4 - Palette UI** - `components/party/PartyCommandBar.vue`.
  - It is a modal over the dashboard, top-centred, about 560px wide, using the
    party modal tokens.
  - It holds the input, a listbox, and row chips.
  - Keyboard handling: Up/Down/Enter/Esc, wraps, keeps the active row visible,
    and resets the highlight to the top on each query change.
  - It emits `pick(command)`.
  - `usePartyCommandBar()` owns `open`, the Cmd/Ctrl+P listener (registered with
    `capture: true` so the `@keydown.stop` on the Add songs, queue builder, and
    rules fields cannot swallow it; `preventDefault` stops Print), and the
    recent list.
  - The header gets the Commands button, labelled by platform
    (`navigator.userAgentData?.platform` or `navigator.platform` matching
    `/mac/i`).
  - While the bar is open, the page's single-key hotkeys stay quiet: the input
    is a text field, so `usePartyHotkeys` already ignores it. The censor
    panel's `D` handler must also ignore it.
  - *Done when:* in a headless browser, Ctrl+P opens the bar, including from
    inside the Add songs search field. Typing "pix" lists Pixelate first with
    `X` and Off. Down/Up move the highlight, Esc closes the bar and restores
    focus, and no print dialog or `beforeprint` event fires.
- [ ] **Step 5 - Run and jump** - wire `pick` in `PartyHostDashboard.vue`.
  - Run sends the `run` command through `send`, then pushes the id to recents.
  - Jump sets `tab` when the command names one, waits for `nextTick`, finds
    `[data-palette-target="<id>"]`, calls `scrollIntoView({ block: "center",
    behavior: "smooth" })` (`auto` under reduced motion), adds a
    `.palette-flash` outline class for 1.2s, and focuses the first enabled
    `input:not([type=checkbox]):not([type=range]), textarea` inside, if any.
  - `data-palette-target` goes on each panel `<section>` and on the specific
    rows a toggle lands on (the Pixelate, Blur and Mute rows in
    `PartyEffectsPanel`, the three option checkboxes in `PartyNowPlaying`, the
    join checkbox, and the music row).
  - A target that is not on the page closes the bar with no error. This covers
    the queue list before a game, or the censor panel with no game.
  - *Done when:* in the browser, with a game loaded, the following all hold.
    The flash does not run under `prefers-reduced-motion`.
    - "pixelate" + Enter turns pixelate on: `effects.pixelate` is 24 in the
      host state, the Screen tab is active, and the Pixelate row is centred and
      flashing.
    - Running it again turns pixelate off.
    - "add songs" focuses the Add songs search box.
    - "new game" switches to the New game tab.
    - "next" advances the song.
    - Recents list the last picks on the next open.
- [ ] **Step 6 - Polish and verify** - add the empty state ("No commands
  match"), a footer hint ("↑↓ to pick · Enter to run · Esc to close"), the
  `?` help row, and the narrow-width behaviour (the bar fills the width under
  600px with 16px gutters).
  - Run `bun run test` and `bun run build`.
  - Take headless screenshots of the bar open (empty with recents, and
    filtered) at 1440px and 400px.
  - *Done when:* tests and build are green, the screenshots are attached, and
    no console errors appear during the Step 4-5 flows.

## Files / areas

- New: `app/utils/fuzzyMatch.ts`, `app/utils/partyHostActions.ts`,
  `app/utils/partyPalette.ts`, `app/utils/partyPaletteRecent.ts`, and a test
  beside each.
- New: `app/components/party/PartyCommandBar.vue` and
  `app/composables/usePartyCommandBar.ts`.
- Changed:
  - `app/composables/usePartyHotkeys.ts`: uses `HOST_ACTIONS`, and the help
    list gains a row.
  - `app/components/party/PartyHostDashboard.vue`: header button, bar mount,
    pick handling, and `data-palette-target`.
  - `data-palette-target` attributes in `PartyEffectsPanel.vue`,
    `PartyNowPlaying.vue`, `PartyJoinPanel.vue`, and `PartyShowPanel.vue`.
  - `PartyCensorPanel.vue`: ignore keys from text fields, if it does not
    already.

## Data / contracts

- No server, route, schema, or `PartyGameState` change. The bar only sends
  `PartyHostCommand`s that existing buttons and hotkeys already send.
- **Load-bearing:**
  - `HOST_ACTIONS` becomes the one place a host hotkey's command is built.
    Later host shortcuts or palette entries add to it rather than to
    `usePartyHotkeys`.
  - `PartyPaletteCommand` and the `data-palette-target` ids are the extension
    point for new host controls.
- `localStorage` key `gaqSrs:partyPaletteRecent`: a JSON `string[]` of command
  ids, newest first, at most 5.

## Testing

- **Test gate is on** (Vitest, `bun run test`). Unit tests cover the pure
  logic:
  - `fuzzyMatch.test.ts` (Step 1).
  - `partyHostActions.test.ts` (Step 2).
  - `partyPalette.test.ts` and `partyPaletteRecent.test.ts` (Step 3).
- The component, the shortcut, scrolling, and focus ride on headless Chromium
  evidence. Run `bun run party` after a build, log in, and drive it with CDP
  scripts as in earlier party features. Load a queue from local cards; there is
  no network for provider lookups.
- Observable checks are listed in each step's done-when.

## Notes for the AI

- **Client only.** `<script setup lang="ts">`, scoped styles with `var(--token)`,
  no hard-coded colours, and no em dashes in copy.
- **Hotkey guards.**
  - Keep `usePartyHotkeys`' guard that ignores modified keys, so Cmd+P never
    also fires `P` (previous song).
  - The bar's own listener must check `metaKey` on macOS and `ctrlKey`
    elsewhere. Accept either on any platform; harmless, and simpler to test
    headless.
  - Ignore `event.repeat`, so holding the keys does not flicker the bar.
- **Shortcut and dialogs.**
  - Do not open the bar while `PartyHotkeyHelp` is open. Close the help first,
    or let Cmd+P replace it.
  - Esc inside the bar must not also close another dialog: stop propagation
    while the bar is open.
- **Rendering.**
  - Toggles act on This song exactly as the hotkeys do (pixelate 24, blur 14).
    When a lightning round owns the picture, the Effects panel already explains
    that; the bar does not need to.
  - The bar renders above `PartyHostAmbient` and every panel. Reuse the
    existing backdrop pattern from `PartyHotkeyHelp`.
- **Leaks.** The bar runs on the host door only and must never be included in
  the display or player pages.
