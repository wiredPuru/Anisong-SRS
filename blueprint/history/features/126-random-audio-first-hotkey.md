# Feature: Random audio-first hotkey

**From build-plan:** feature 126
**Status:** verified

## Goal

One key on Study marks the current card Audio first with the Random style
(Blur, Pixelate or Peephole, rolled per showing), or clears that mark, without
opening the Edit card panel. Spotting "this one should be hidden" mid-session
becomes a single press instead of E, Audio first, pick Random, close.

Also fixes a feature 124 bug: Study's edit form shows without Edit card being
pressed and disappears when Audio first is clicked, so the style picker can't
be used.

## In scope

- **Bug fix (step 1).** In `StudyCardEditPanel.vue` the Audio first badge sits
  between the Edit card button (`v-if="!editing"`) and the form (`v-else`), so
  the form's `v-else` chains to the badge. Result today:
  - a card not marked Audio first shows the form while `editing` is false, with
    blank path fields and grading not locked (Save there would send null paths
    and delete the local files);
  - clicking Audio first in that phantom form makes the badge's condition true,
    so the form vanishes along with the style picker.
  The form must render only while `editing` is true, and the badge only while
  not editing.
- A new rebindable hotkey action `audioFirstRandom`, label "Audio first
  (Random)", Study scope only, default `R`, no alternate. Listed in Settings >
  Hotkeys under the Study group and in Study's hotkey legend.
- Pressing it on the current card:

  | Card now | Request | Note shown |
  |---|---|---|
  | Not audio first | `{ audioFirst: true, style: "random" }` | Audio first: Random |
  | Audio first, another style | `{ audioFirst: true, style: "random" }` | Audio first: Random |
  | Audio first, Random | `{ audioFirst: false }` | Audio first off |

- The current card updates in place through the existing `onCardEdited` path,
  so the badge, the edit panel and `sessionHistory` follow. Before the answer is
  revealed the picture is obscured at once by the already-built 125 logic;
  after reveal the mark shows from the next showing.
- Works while the round has a result (typed result panel or after manual
  grading, before the next card), since that is when you most likely decide a
  card needs hiding.
- A short note over the player (about 1.2s, reduced-motion safe) confirming the
  change, and an inline error note if the request fails (card unchanged).

## Out of scope

- Listen and Preview. Listen ignores styles (feature 125), so marking from it
  would look like nothing happened.
- Hotkeys for the other styles, or a key that cycles through styles.
- Any server, schema, or route change. `POST /api/cards/audio-first` already
  takes `style` (`parseAudioFirstBody`, `server/utils/cardAudioFirst.ts`).
- Changing what the Audio first button inside the edit form does.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Fix the edit form's conditional** - in
  `StudyCardEditPanel.vue`, give the form its own `v-if="editing"` (the badge
  keeps `v-if="!editing && card.audioFirst"`), so neither chains to the other.
  *Done when:* on `/study`, flipping to details on a card not marked Audio
  first shows only the Edit card button, no form; pressing Edit card (or E)
  opens the form; clicking Audio first there keeps the form open with the
  style picker visible, and picking Pixelate saves it; Missed/Got it are
  disabled only while the form is actually open. Verified in the browser.

- [x] **Step 2 - Toggle logic + hotkey action** - a pure
  `nextRandomAudioFirst({ audioFirst, audioFirstStyle })` in
  `app/utils/audioFirst.ts` returning the request body and the note text per
  the table above, with tests. Add `audioFirstRandom` to `HotkeyActionId` and
  `HOTKEY_ACTIONS` (`["study"]`, default `r`), with hotkey tests. No Study
  wiring yet, so pressing R does nothing. *Done when:* `bun run test` passes
  with the new cases, and Settings > Hotkeys lists "Audio first (Random)" under
  Study bound to R and can rebind it.

- [x] **Step 3 - Wire it into Study** - in `app/pages/study/index.vue`, a
  `markRandomAudioFirst()` that ignores repeats, does nothing with no card,
  while loading, while a request is already in flight, or while Previous card,
  the session log, Filters or Find source is open; otherwise posts the body,
  calls `onCardEdited`, and shows the note. Register it in `PAGE_ACTIONS` and
  in the round-result branch of `onKeydown`. Add it to the hotkey legend.
  *Done when:* on `/study`, before reveal on an unmarked card, R obscures the
  picture with Blur, Pixelate or Peephole and shows "Audio first: Random"; R
  again shows "Audio first off" and the picture returns; after grading, R marks
  the card without changing the shown result, and the badge on the details
  side reads Random; reloading `/cards` shows the card's style as Random; R
  typed inside a typed-answer box enters the letter and does not toggle.

- [x] **Step 4 - Note styling and failure path** - the note's look (tokens
  only, Kai's pill banner style), reduced-motion handling, and the error note
  when the request fails. *Done when:* with the dev server stopped mid-session
  (or the route forced to fail), R shows an error note and the card's mark is
  unchanged; with `prefers-reduced-motion` the note appears without animation;
  screenshots in light and dark themes.

## Files / areas

- `nuxt-app/app/components/study/StudyCardEditPanel.vue` - step 1.
- `nuxt-app/app/utils/audioFirst.ts` + `audioFirst.test.ts` - step 2.
- `nuxt-app/app/utils/hotkeys.ts` + its test - step 2.
- `nuxt-app/app/pages/study/index.vue` - steps 3 and 4 (handler, legend, note).
- Possibly a small `nuxt-app/app/components/study/StudyFlashNote.vue` for the
  note, if it doesn't fit cleanly in the page - step 4.

## Data / contracts

- Request (existing): `POST /api/cards/audio-first`
  `{ ids: [cardId], audioFirst: true, style: "random" }` or
  `{ ids: [cardId], audioFirst: false }`. Unmarking keeps the stored style,
  which is fine: re-marking with the hotkey always sends `random`.
- New hotkey action id `audioFirstRandom` (load-bearing: saved in
  `localStorage` `gaqSrs:hotkeys` once rebound, so the id must not change).
- `nextRandomAudioFirst` return shape:
  `{ body: { audioFirst: true; style: "random" } | { audioFirst: false }; note: string }`.

## Testing

Vitest is configured, so logic ships with tests:

- `nextRandomAudioFirst`: unmarked -> mark Random; marked Blind/Blur/Pixelate/
  Peephole -> mark Random; marked Random -> unmark; note text for each.
- Hotkeys: the default bindings still validate as a set with `audioFirstRandom`
  added; `r` doesn't conflict with Listen's Reveal (different scopes); a saved
  override that already binds `r` to another Study action leaves
  `audioFirstRandom` unbound rather than stealing the key or rejecting the
  saved set.

UI behaviour (steps 1, 3, 4) rides on browser evidence plus `bun run build`.

## Notes for the AI

- Client only. No server route, migration, or `project-plan.md` change.
- Step 1 is a real data-safety fix: the phantom form's Save clears local paths,
  which deletes files via `deleteFileIfUnreferenced`. Confirm the fix with the
  browser, not just by reading the template.
- Check how `resolveBindings`/`parseStored` treat a stored override that already
  uses `r` in Study before writing the hotkey test; existing users must not lose
  their saved bindings because a new default collides.
- The round-result branch of `onKeydown` early-returns for every action not
  listed; add `audioFirstRandom` there or the key dies after grading.
- `isTypingTarget` already guards text fields; don't add a second guard.
- Reuse the `cardEditing`/`viewedHistoryEntry`/`showSessionLog` gating style
  already used by other Study handlers. Editing being open should not block the
  hotkey; the edit panel re-renders from the updated card.
- Tooltip and legend text must come from `hotkeyHint`, so a rebound or unbound
  key shows correctly.
- Colors and spacing from `main.css` tokens only; no em dashes in copy.
