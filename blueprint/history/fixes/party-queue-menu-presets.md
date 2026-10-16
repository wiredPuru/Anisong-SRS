# Party queue: scrollable list, song menu, effect presets

**Type:** Fix
**Status:** verified

## The problem

The party host queue (`PartyQueueList.vue`, with the next-song chips in the same
file and `PartyEffectsPanel.vue`) is awkward to use:

- The queue is a fixed 5-row window plus a collapsed "played" log. You cannot
  scroll back through played songs or ahead through upcoming ones in one list.
- Clicking a song row jumps to and plays it immediately (`emit('jump')`).
- Each upcoming row carries up/down, reroll and remove buttons. Only the drag
  grip and remove make sense.
- The next-song chips are a hard-coded `QUICK` list in the component (Full blur,
  Pixelate, Mute, Music player, Bubbles) and cannot be saved or randomised.
- The "Pick another" action should be called **Reroll**.

## The fix

All of this is host-panel UI over existing party commands; the party game model
(`PartyEffects`, `nextEffects`, `effects`, `queueMove`, `queueRemove`,
`queueReroll`, `queueShuffle`) is reused as is.

1. **Scrollable, lazy queue.** One scroll box (about 5 rows tall) holding played,
   current and upcoming songs in order, opened scrolled to the current song with
   a visible "now playing" row. Rows render in chunks as you scroll (played
   upward, upcoming downward), so a 2000-song queue stays fast. The collapsed
   played log is replaced by this list; "Export CSV" stays. Endless mode keeps
   its current short window.
2. **Row actions.** Upcoming rows keep only the drag grip (left) and the X
   (remove). The up/down and per-row reroll buttons go. Shuffle stays in the
   header; the Up next "Pick another" button is renamed **Reroll**.
3. **Click opens a song menu, never plays.** Clicking any row expands an inline
   panel for that song with: **Play now** (the old `jump`), **Reroll** (upcoming
   only), the same effect toggles as Up next but applied to that song, and
   **Edit card**. A song-specific effect set needs a per-song override: a new
   optional `effects` on `PartyQueueItem`, applied when the game moves to it
   (same path `nextEffects` uses today), via a new `queueEffects` host command.
4. **Dynamic effect options.** One registry (`app/utils/partyEffectOptions.ts`)
   lists the options, so adding or removing one (for example Bubbles) is a
   one-line change used by Up next, the song menu and the Effects panel chips.
   Two groups: **Effects** (Blur, Pixelate, Bubbles) and **Playback** (Music
   player, Mute). Each is a toggle.
5. **Presets.** A **Save** button stores the current toggle set as a named
   preset (browser `localStorage`, `gaqSrs:partyEffectPresets`, with a
   try/catch fallback); presets appear as chips that apply in one tap and can be
   deleted. A **Random** toggle in the Effects group means "pick one of the
   effects (Blur, Pixelate, Bubbles) at random for each song"; it is resolved
   when the song starts, and Mute and Music player are never randomised. Random
   can be part of a saved preset.
6. **Edit card: modal, not a new tab.** The host panel is served from the
   control door, whose allowlist does not include `/cards`, and a phone remote
   could not open it anyway. So Edit card opens a small modal (song title,
   theme slot, artist, notes) backed by a new host-door route wrapping the
   existing card update logic behind the host session check. The queue item
   refreshes after saving.

**Must not break:** the display never receives answers before reveal; party play
still never writes `ReviewLog`, `Card` or `CardTrack`; existing drag reorder,
remove, lightning and endless behaviour; Shift+P command bar entries that
toggle these effects.

## Build steps

- [x] **1. Effect option registry + presets.** `partyEffectOptions.ts` (options,
  groups, apply/read helpers, Random resolution, preset parse/serialize) with a
  Vitest file; wire Up next chips and the Effects panel's next-song chips to it,
  rename "Pick another" to Reroll, add Save/preset chips. *Done when:* chips
  come from the registry, a saved preset survives a reload and applies in one
  tap, Random picks one of blur/pixelate/bubbles, tests pass.
- [x] **2. Scrollable lazy queue + row cleanup.** Single scroll list with
  chunked rendering, grip and X only, played songs visible by scrolling up.
  *Done when:* a 2000-song queue scrolls smoothly, only about 5 rows are
  visible at once, and no up/down buttons remain.
- [x] **3. Song menu with per-song effects.** Click expands the menu (Play now,
  Reroll, toggles, Edit card placeholder); add `queueEffects` command and the
  optional per-item `effects` in `partyGame.ts`, with reducer tests. *Done when:*
  clicking a row does not change the playing song, Play now does, and a song's
  toggles apply when it starts.
- [x] **4. Edit card modal.** Host-door update route and modal. *Done when:*
  editing a queued song's title/artist/notes saves and the queue row updates.

## Verify

- `bun run test` and `bun run build` in `nuxt-app/`.
- `bun run party`, open `/party/host`, load a large queue: scroll back and
  ahead, click a row (nothing plays), use Play now, drag to reorder, X to
  remove, toggle effects on a song and on Up next, Save and reuse a preset,
  turn on Random and watch the display over several songs, edit a card.
