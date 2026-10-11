# Feature: Settings > Hotkeys (103c)

**From build-plan:** feature 103c (third sub-feature of 103, Configurable hotkeys + Space to play/pause)
**Status:** complete

## Goal

Let people rebind every Study, Listen and Preview hotkey from a Settings screen,
and reach it from where they use the keys. 103a built the registry and 103b made
the pages follow it, so today a binding can only change by hand-editing saved
browser data. This adds the screen that does it, with clear conflict messages,
and a "Hotkeys..." link in the Display menu on Study and Listen.

## In scope

- A **Hotkeys** section in Settings (`/settings?section=hotkeys`), after
  Playback, outside the settings fetch like About and Library health.
- A list of every action in `HOTKEY_ACTIONS`, grouped by where it works
  (Everywhere, Study and Listen, Study only, Listen only, Cards and Preview),
  each with a **Primary** and an **Alternate** key button and a **Reset** link.
- Click a key button, then press a key to bind it. While waiting: Escape
  cancels, Backspace or Delete clears that slot, holding Ctrl/Cmd/Alt is
  refused ("Plain keys only"), and a modifier on its own is ignored.
- Clear messages for a refused key: reserved (Enter, Escape, Tab), already used
  by another action on the same page (named), or the same key in both slots. A
  refused key changes nothing; the person frees the other key first.
- **Reset** per action (refused with the reason if another action now holds a
  default key) and **Reset all** behind an inline confirm.
- A **Hotkeys...** link at the bottom of the Display menu on Study and Listen,
  opening the section in a new tab so the session is not lost.
- A short note listing the keys that cannot change (Enter, Escape, Tab, and the
  typed-answer box keys).

## Out of scope

- Swapping two actions' keys in one click, import or export of bindings, and
  per-profile bindings.
- Party mode's hotkeys, and modifier combinations.
- The saved format, validation rules and page wiring (103a and 103b).

## Build loop

Build one step at a time, never the whole feature at once.

## Build steps

- [x] **Step 1 - Editor helpers (pure).** `app/utils/hotkeyEditor.ts` with
  `captureKey`, `describeBindingFailure` and `hotkeyGroups`, plus tests. *Done
  when:* `bun run test` passes and the tests cover every capture outcome, each
  failure message, and the group order and membership of all 16 actions.
- [x] **Step 2 - Hotkeys section.** `SettingsHotkeys.vue` and the `hotkeys`
  section in `settings.vue`. *Done when:* in the browser, a key can be rebound,
  cleared and reset, the conflict, reserved, duplicate and plain-keys messages
  show, Reset all confirms first, changes persist across a reload, and the keys
  work on the pages afterwards.
- [x] **Step 3 - Display menu link.** The "Hotkeys..." link in
  `StudyDisplayMenu.vue`. *Done when:* on Study and Listen the link is in the
  Display menu and opens the Hotkeys section in a new tab, and Study's session
  is untouched.
- [x] **Step 4 - End-to-end proof.** No new code unless a bug turns up.
  Rebind through the screen, then use the keys on Study, Listen and the cards
  inspector. *Done when:* the evidence in Testing is recorded and the console is
  clean.

## Files / areas

- New: `app/utils/hotkeyEditor.ts`, `hotkeyEditor.test.ts`,
  `app/components/settings/SettingsHotkeys.vue`.
- Changed: `app/pages/settings.vue`, `app/components/study/StudyDisplayMenu.vue`.

## Data / contracts

No schema or route change; bindings stay in `localStorage` (`gaqSrs:hotkeys`)
through `useHotkeys()` (103a). The screen calls only `bindings`, `setBinding`,
`reset`, `resetAll` and `refresh`.

```ts
// app/utils/hotkeyEditor.ts
type CaptureOutcome =
  | { kind: "key"; key: string }        // a normalised key to try binding
  | { kind: "clear" }                   // Backspace or Delete
  | { kind: "cancel" }                  // Escape
  | { kind: "rejected"; message: string } // Ctrl, Cmd or Alt held
  | { kind: "ignore" };                 // modifier alone, key repeat, IME
function captureKey(event: KeyboardEvent-like): CaptureOutcome;
function describeBindingFailure(failure, key: string): string;
function hotkeyGroups(): { label: string; actions: HotkeyAction[] }[];
```

- Enter and Tab are returned as `key` so the registry's reserved rule produces
  the message; Escape is never bindable because it cancels.
- Messages name the other action by its registry label and show the key the way
  the tooltips do (`formatKey`).

## Testing

- **Unit (Vitest, step 1):** the three helpers.
- **UI evidence (headless Chromium via `playwright-cli`, production build against
  a throwaway copy of the database; results):**

| Check | Result |
|---|---|
| Section and groups | Hotkeys after Playback; five groups in order; 16 rows |
| Rebind Hide video to X | Row "X / Not set", saved as `{"hideVideo":{"primary":"x",...}}` |
| Key another action holds (I) | "I is already used by Hide info. Change or clear that one first."; nothing changed, still waiting for a key |
| Enter, Ctrl+K | "Enter can't be used: ..."; "Plain keys only: hold no Ctrl, Cmd or Alt." |
| Esc | Cancels; the row is unchanged (the leftover message now clears too) |
| Backspace and Delete | Clear a slot; an action can be left fully unbound |
| Same key in both slots | "Primary and alternate must be different keys." |
| Space for another action | Refused, naming Play / pause |
| Reset one; Reset when its default key was since taken | Restored; refused: "Can't reset Hide video. V is already used by Hide cover. ..." |
| Reset all | Confirm first, nothing changed until confirmed; saved overrides emptied |
| Reload | Bindings persist |
| Keyboard only | Tab to a key button, Enter starts capture (the held Enter is not captured), then a key binds |
| Display menu link | Present on Study and Listen as `/settings?section=hotkeys` with `target=_blank`; Study stayed on `/study` with its player |
| Rebind in the Settings tab with Study open in another tab | Study's tooltips updated with no reload; X, K work, V, S and Space do nothing; Listen follows (K plays, X toggles video) |
| Console | No errors |

**Not checked:** the `/cards` inspector and Preview with rebound keys (unchanged
by this feature, covered in 103b) and Firefox.

## Notes for the AI

- Capture with a capture-phase `keydown` listener that stops the event, so no
  page hotkey fires while a key is being chosen; ignore `event.repeat` so the
  Enter that activated the button is not captured as a key. Cancel on blur or an
  outside click.
- Use the existing Settings panel look and `var(--token)` styles; no inline
  styles. Announce messages in a `role="status"` region.
- Look up everything through `useHotkeys()`; do not read or write
  `localStorage` here.
- No em dashes in code, comments or docs.
