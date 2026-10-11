# Feature: Hotkey registry (103a)

**From build-plan:** feature 103a (first sub-feature of 103, Configurable hotkeys + Space to play/pause)
**Status:** complete

## Goal

Give every Study, Listen and Preview hotkey a name, a default key and a
validated, saved binding, in one pure module plus a small composable. Nothing
consumes it yet, so the app behaves exactly as it does today. 103b wires the
pages to it and adds Space; 103c adds the rebinding UI. Locking the contract
here keeps those two from guessing at it.

## In scope

- `app/utils/hotkeys.ts` (pure): the action list with defaults and scopes, key
  normalisation, binding validation, saved-override parsing/serialising, key
  labels, and event-to-action lookup.
- `app/utils/hotkeys.test.ts`: Vitest coverage of all of the above.
- `app/composables/useHotkeys.ts`: shared reactive bindings loaded from and
  saved to `localStorage`, following `useAmbientPreference.ts`.

## Out of scope

- Any change to an existing key handler, tooltip or legend (103b).
- The Settings > Hotkeys section and the Display menu link (103c).
- Party mode's hotkeys (`usePartyHotkeys`, `party/display.vue`, `party/play.vue`).
- Fixed keys: Enter, Escape, Tab, and the typed-answer box keys (Up/Down,
  Space on an empty box). These are structural and never appear in the registry.
- Modifier combinations (Ctrl/Cmd/Alt). Plain keys only.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Registry: actions, defaults, normalisation** - create
  `hotkeys.ts` with `HOTKEY_ACTIONS`, `normalizeKey`, `eventKey`,
  `formatKey`, and the first tests, including a parity test that pins every
  default to today's hard-coded key. *Done when:* `bun run test` passes; the
  parity test fails if any default differs from the table in Data / contracts.
- [x] **Step 2 - Registry: bindings, validation, persistence format** -
  `resolveBindings`, `validateBinding`, `applyBinding`, `parseStored`,
  `serializeOverrides`, `actionForEvent`, `hotkeyHint`, with tests for each
  unhappy path. *Done when:* tests cover reserved keys, same-scope conflicts,
  cross-scope reuse, primary equal to alternate, clearing the alternate,
  corrupt storage, and stored conflicts; `bun run test` passes.
- [x] **Step 3 - `useHotkeys()` composable** - `useState`-backed bindings,
  `refresh()` (read storage), `setBinding`, `reset`, `resetAll`, plus a
  `storage` event listener so a second tab follows changes. Storage reads and
  writes are try/catch guarded like `useAmbientPreference`. *Done when:*
  `bun run build` and the typecheck pass, nothing else in the app imports it
  yet, and the Study, Listen and Preview keys still behave as before (quick
  manual check of `S`, `I`, `V`, `P`, arrows).

## Files / areas

- New: `nuxt-app/app/utils/hotkeys.ts`, `nuxt-app/app/utils/hotkeys.test.ts`,
  `nuxt-app/app/composables/useHotkeys.ts`.
- No existing file changes.

## Data / contracts

**Load-bearing:** 103b and 103c both build on these shapes.

```ts
type HotkeyScope = "study" | "listen" | "preview";

type HotkeyActionId =
  | "playPause" | "hideVideo" | "hideCover" | "hideInfo" | "ambient"
  | "flipCard" | "previousCard" | "sessionLog" | "editCard" | "undo"
  | "pass" | "fail" | "reveal" | "listenNext" | "listenPrevious" | "expand";

interface HotkeyAction {
  id: HotkeyActionId;
  label: string;            // shown in Settings and tooltips, e.g. "Play / pause"
  scopes: HotkeyScope[];    // where the action exists; conflicts only count inside a shared scope
  defaults: { primary: string; alternate: string | null };
}

interface HotkeyBinding { primary: string | null; alternate: string | null }
type HotkeyBindings = Record<HotkeyActionId, HotkeyBinding>;
```

- A **key** is a normalised string: letters/symbols lowercased from
  `event.key` (`"s"`, `"?"`), the spacebar is `"space"`, named keys are
  lowercased (`"arrowleft"`). Shift is ignored, as today. Ctrl/Cmd/Alt held
  means no key (`eventKey` returns `null`).
- **Reserved** (never bindable): `enter`, `escape`, `tab`, bare modifiers,
  `dead`, `unidentified`, `process` (IME).
- **Conflict:** the same key on two different actions whose `scopes`
  overlap. `playPause` spans all three scopes, so no other action may share
  its keys; `pass`/`listenNext` (both `arrowright`) are allowed because their
  scopes never overlap. Within one action, primary and alternate must differ.
- **Stored shape:** `localStorage["gaqSrs:hotkeys"]` =
  `{ "v": 1, "overrides": { [actionId]: { primary, alternate } } }`, holding
  only actions that differ from their defaults. An unknown action id, a
  non-string key, a reserved key or a conflict drops that one override back
  to its default; bad JSON or a wrong version yields all defaults.
- `validateBinding` returns `{ ok: true }` or
  `{ ok: false, reason: "reserved" | "conflict" | "duplicate", conflictsWith?: HotkeyActionId }`.
- `actionForEvent(bindings, scope, event)` takes the minimal
  `{ key, ctrlKey, metaKey, altKey }` and returns the matching action in that
  scope or `null`. Callers still own `isComposing`, `repeat` and typing-target
  checks.
- `hotkeyHint(bindings, id)` returns the display text, e.g. `"Space / S"` for
  two keys, `"V"` for one, `""` when unbound. `formatKey` gives `Space`, `←`
  `→`, uppercase letters.

Defaults (must equal today's hard-coded keys, plus Space):

| Action | Scopes | Primary | Alternate |
|---|---|---|---|
| `playPause` | study, listen, preview | `space` | `s` |
| `hideVideo` | study, listen | `v` | - |
| `hideCover` | study, listen | `c` | - |
| `hideInfo` | study, listen | `i` | - |
| `ambient` | study, listen | `a` | - |
| `flipCard` | study, listen | `d` | - |
| `previousCard` | study | `p` | - |
| `sessionLog` | study | `l` | - |
| `editCard` | study | `e` | - |
| `undo` | study | `u` | - |
| `pass` | study | `arrowright` | - |
| `fail` | study | `arrowleft` | - |
| `reveal` | listen | `r` | - |
| `listenNext` | listen | `arrowright` | - |
| `listenPrevious` | listen | `arrowleft` | - |
| `expand` | preview | `f` | - |

Note: `playPause` lists `space` first in the registry, but until 103b ships
the live behaviour is still `S` only.

## Testing

Vitest is configured, so this logic ships with tests in the same diff.

- **Tested (pure logic):** everything in `hotkeys.ts`: defaults parity,
  `normalizeKey`/`eventKey` (space, letters with Shift, arrows, Ctrl held),
  `validateBinding` (reserved, conflict, cross-scope reuse, duplicate),
  `applyBinding` (swap-free: it only sets, never silently steals),
  `parseStored` (bad JSON, wrong version, unknown id, stored conflict),
  `serializeOverrides` (defaults omitted), `actionForEvent`, `hotkeyHint`,
  `formatKey`.
- **Not unit-tested:** `useHotkeys()` (thin state and storage wrapper). It is
  covered by build and typecheck, plus the manual regression check in Step 3.
- Run with `bun run test` from `nuxt-app/`.

## Notes for the AI

- Match `useAmbientPreference.ts`: `useState`, a client-only `refresh()`, and
  try/catch around every storage call with a one-line why-comment.
- No `any`; keep functions short; comments only for non-obvious decisions
  (why conflicts are per-scope, why Shift is ignored).
- No em dashes in code, comments or commit messages.
- Do not touch any existing key handler. If a handler's real behaviour
  disagrees with the defaults table (check `study/index.vue`, `listen/index.vue`,
  `StudyMediaPlayer.vue`, `StudyAnswerControls.vue`), stop and flag it rather
  than bending the table.
- 103b follow-ups to remember (not this step): Space must be ignored when the
  target is an interactive element, `preventDefault` it to stop page scroll, and
  Study's typed-mode "give up" on the right arrow should follow the `pass`
  binding.
