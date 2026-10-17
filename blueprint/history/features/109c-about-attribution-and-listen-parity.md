# Feature: About attribution and Listen parity

**From build-plan:** feature 109c (Japanese breakdown panel)
**Type:** Feature
**Status:** verified

## Goal

Finish feature 109: Listen gets the same J flip to the Japanese breakdown as
Study (same setting, same panel), and Settings > About credits the kanji data
as its CC BY-SA licence asks.

## Decisions (made at intake)

- **Listen mirrors Study exactly**: `flipJapanese` joins the Listen scope, the 漢
  header button and the second `StudyDetailsCard` appear only with the setting on,
  opening one of Details / Japanese closes the other, and the panel is blurred and
  inert while Listen's own `infoHidden` is true.
- **Attribution lives in Settings > About**, outside the settings fetch like the
  version panel, so it is always readable. It names KANJIDIC2 and KRADFILE, the
  EDRDG, the CC BY-SA 4.0 licence, links the licence page, and states that the
  data was reduced to the fields the app uses.
- No server, schema, or contract change.

## Build steps

- [x] **Step 1 - Listen wiring.** Add `listen` to `flipJapanese`'s scopes
  (registry and its test), then the setting read, `showJapanese` state with
  exclusivity and reset, header button, second card, Now Playing, and the hotkey
  in `listen/index.vue`. *Done when:* with the setting on, J opens the panel on
  Listen, D swaps to Details, the panel is blurred while info is hidden; with it
  off, J does nothing and no button shows.
- [x] **Step 2 - About attribution.** A "Kanji data" panel in Settings > About.
  *Done when:* it renders with the licence link and the changes note.
- [x] **Step 3 - Proof.** `bun run test`, `bun run build`, and a walk on an
  isolated server (own port and data dir, process checked first). *Done when* all
  pass and the evidence is recorded below.

## Notes for the AI

- Verify only on an isolated server on a free port with its own `GAQ_SRS_DATA_DIR`;
  check the process owning the port before any POST.
- No em dashes in copy, comments or commits.

## Evidence (step 3)

Isolated dev server (own `GAQ_SRS_DATA_DIR`, port 3014, process checked) with one
seeded card.

- `/listen`, setting off: J did nothing and no 漢 button rendered.
- `/listen`, setting on: the 漢 header button appeared and J flipped to the same
  panel as Study (頃 and 歌 tiles, script switch, "Keep watching?" bar).
  `infoHidden` was false in this walk, so the panel was clear.
- `/settings?section=about`: the Kanji data panel renders with the CC BY-SA 4.0
  link and the reduced-fields note.
- `bun run test` (2508 passed) and `bun run build` pass.

**Not browser-verified:** the blur while Listen's info is hidden (same prop as
Study's, which was checked in 109b), and D and J swapping on Listen.
