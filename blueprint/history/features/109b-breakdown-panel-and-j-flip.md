# Feature: Breakdown panel and J flip

**From build-plan:** feature 109b (Japanese breakdown panel)
**Type:** Feature
**Status:** verified

## Goal

On Study, J flips the picture over to a second card, the Japanese breakdown:
the song's and the anime's native titles, each kanji laid out RTK style (keyword,
component parts, readings, stroke count) from 109a's `GET /api/kanji`, with a
Normal | All hiragana | All katakana switch for the title text. D still flips
to Details; opening one closes the other. It is off until a Settings toggle
turns it on.

## Decisions (made at intake)

- **The Settings toggle moves into 109b** (from 109c), so the panel is never
  always-on before its switch exists. 109c keeps the About attribution and
  Listen parity. Stored in the database like `autoDownload`:
  `MediaLibrarySettings.japaneseBreakdown`, default false, in Settings > Playback.
- **Reuses `StudyDetailsCard` as the shell** (trading-card frame over the player,
  cover on the left), so it looks and flips like Details.
- **Hide Info rules:** the panel carries the answer, so it is blurred and inert
  exactly when Study's info panel is (typed round open, or Hide Info before reveal).
- **Script switch** applies to the titles only; kanji tiles always show the
  kanji. The choice is remembered in the browser (`gaqSrs:japaneseScript`).
- **Conversion is local**: kuroshiro/kuromoji (already bundled), so it works
  offline.
- **Hotkey** `flipJapanese`, default `j`, a normal rebindable action (feature 103).
  Study scope now; Listen joins in 109c.
- Out of scope: Listen, About attribution (109c); custom keywords; stroke-order art.

## Build steps

- [x] **Step 1 - Setting (server + client).** Column + migration `0039`,
  `getJapaneseBreakdown`/`setJapaneseBreakdown`, `POST
  /api/media-library/japanese-breakdown`, on the `/api/media-library` payload,
  a Settings toggle, and the migration test row. *Done when:* tests pass; the
  toggle persists across a reload.
- [x] **Step 2 - Kana conversion (server).** `toKanaText(text, to)` in
  `server/utils/furigana.ts` and `GET /api/japanese-script?text=&to=hiragana|katakana`
  (400 for missing text or a bad target, text capped at 200). A pure `shiftKana` pass after kuroshiro converts the other script's kana, which kuroshiro leaves alone when a title has no kanji. *Done when:* a test
  shows `歌` -> `うた` / `ウタ` and kana/latin pass through; the route validates.
- [x] **Step 3 - Panel component.** `JapaneseBreakdown.vue` plus pure helpers in
  `app/utils/japaneseBreakdown.ts` (script parse/persist, which titles to show,
  reading formatting). Fetches `/api/kanji` and the converted titles per card;
  loading, error, and "no kanji in this title" states; a script switch. *Done
  when:* helper tests pass; the component renders in the browser for a card with
  kanji and one without.
- [x] **Step 4 - Study wiring.** `flipJapanese` in the hotkey registry (+ its
  tests), `showJapanese` state, exclusivity with Details, a header button, the
  stage's flipped state, Now Playing's "Back to the video", the Hide Info blur,
  and only when the setting is on. *Done when:* with the setting on, J opens the
  panel, D swaps to Details, the panel is blurred while a typed round is open,
  and a new song resets it; with it off, J does nothing and no button shows.
- [x] **Step 5 - Proof.** `bun run test`, `bun run build`, and a walk in the
  browser on an isolated server (own port and data dir, process checked first).
  *Done when* all pass and the evidence is recorded below.

## Contracts

- `GET /api/japanese-script` -> `{ text: string }` (the converted title).
- Hotkey id `flipJapanese` (load-bearing for 109c's Listen scope).
- `JapaneseBreakdown` props: `animeTitleNative`, `songTitleNative`, `blurred`.

## Notes for the AI

- Verify only on an isolated server on a free port with its own `GAQ_SRS_DATA_DIR`;
  check the process owning the port before any POST.
- No em dashes in copy, comments or commits.

## Evidence (step 5)

Isolated dev server (own `GAQ_SRS_DATA_DIR`, port 3013, process checked) with one
seeded card (ひぐらしのなく頃に / 歌).

- `GET /api/japanese-script` turned ひぐらしのなく頃に into ひぐらしのなくころに
  (hiragana) and ヒグラシノナクコロニ (katakana); a bad target and a missing text
  both returned 400.
- Setting off: pressing J did nothing and there was no header button. Setting
  on: the 漢 header button appeared and J flipped to the panel.
- The panel showed 頃 (time; about, toward; parts, ケイ/キョウ, ころ/ごろ/しばら(く),
  11 strokes, RTK #479) and 歌 (song; sing; parts, カ, うた/うた(う), 14 strokes,
  RTK #508) under their titles. While the answer was still hidden it was blurred
  and inert (`.jb.blurred`); after Reveal it was clear.
- Found and fixed in the walk: the component had to be named `StudyJapaneseBreakdown`
  to resolve from `components/study/`, and the active script pill was white on white.
- `bun run test` (2508 passed) and `bun run build` pass.

**Not browser-verified** (the measure tool sends one click or key per run): clicking
the Hiragana/Katakana switch in the panel, D and J swapping cards, the typed-round
blur, and a new song resetting the panel. The helpers and conversion are unit
tested; the swap and reset are plain watchers in `study/index.vue`.
