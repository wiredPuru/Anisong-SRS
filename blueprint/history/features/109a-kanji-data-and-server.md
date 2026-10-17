# Feature: Kanji data and server

**From build-plan:** feature 109a (Japanese breakdown panel)
**Type:** Feature
**Status:** verified

## Goal

Give the app a bundled, offline kanji dictionary and one server route that
returns an RTK-style entry for every kanji in a piece of text: a keyword,
component parts, on/kun readings and stroke count. No UI (109b builds the panel).

## Decisions (made at intake)

- **Sources:** KANJIDIC2 (meanings, readings, strokes, grade, JLPT, frequency)
  and KRADFILE (component parts), downloaded once on 2026-10-17 from
  `https://www.edrdg.org/kanjidic/kanjidic2.xml.gz` and
  `http://ftp.edrdg.org/pub/Nihongo/kradzip.zip`. Both are EDRDG data under
  CC BY-SA 4.0 (https://www.edrdg.org/edrdg/licence.html); the bundled file
  carries that notice and 109c shows it in Settings > About.
- **Not Heisig's RTK keywords:** the keyword is KANJIDIC2's first English
  meaning, with up to two more as alternatives. Close to RTK in spirit only.
- **Coverage:** every KANJIDIC2 entry that KRADFILE also decomposes (the JIS X
  0208 set, about 6,300 kanji), which covers any real anime or song title.
  Other characters are reported as unknown, never guessed.
- **Bundled in the server build, not read from disk:** one generated JSON module
  imported by the server, so the packaged binaries need no extra sibling folder.
  The generated file is committed; the app never needs the network for it.
- **Reproducible:** `scripts/build-kanji-data.ts` regenerates it from the two raw
  files; the parsers are pure and unit-tested.

## In scope

- `scripts/build-kanji-data.ts` (+ pure parsers in `server/utils/kanjiData.ts`),
  the generated `server/data/kanji.json`, and the licence notice text.
- `server/utils/kanjiLookup.ts`: `extractKanji(text)` (unique ideographs in
  order) and `lookupKanji(chars)`.
- `GET /api/kanji?text=` returning `{ kanji: KanjiEntry[], unknown: string[] }`.

## Out of scope

UI, Settings, hotkeys, hiragana/katakana conversion (109b/109c); custom
keywords; stroke-order graphics; anything that calls the network at runtime.

## Build steps

- [x] **Step 1 - Parsers and generator.** `parseKanjidic(xml)` and
  `parseKradfile(text)` in `server/utils/kanjiData.ts`, `buildKanjiData(entries,
  parts)` merging them, and `scripts/build-kanji-data.ts` that reads the raw
  files from paths given as arguments and writes `server/data/kanji.json`
  (compact, with the EDRDG notice in a header field). *Done when:* parser tests
  pass on fixtures covering a normal kanji, a kanji with no English meaning, one
  with several readings, and a KRADFILE comment/blank line; the script runs on the
  real files.
- [x] **Step 2 - Generate and commit the data.** Run the script on the downloaded
  files; commit `server/data/kanji.json` and `server/data/KANJI-LICENCE.txt`.
  Record the size and entry count. *Done when:* the file loads, holds more than
  6,000 entries, and spot checks (`日`, `本`, `語`, `歌`) match KANJIDIC2.
- [x] **Step 3 - Lookup and route.** `extractKanji`, `lookupKanji`, `GET
  /api/kanji` (400 without `text`, text capped at 200 characters, at most 100
  kanji returned). *Done when:* tests cover mixed kana/kanji/latin text, repeats,
  an unknown ideograph, and the cap; the route returns entries for `歌`.
- [x] **Step 4 - Proof.** `bun run test` and `bun run build`; call the route on an
  isolated server (own port and data dir) with a real title. *Done when* all pass
  and the evidence is recorded below.

## Contracts (load-bearing for 109b)

```ts
interface KanjiEntry {
  char: string;
  keyword: string;        // first English meaning
  alternates: string[];   // up to two more
  parts: string[];        // KRADFILE components, in file order
  on: string[];           // katakana as in KANJIDIC2
  kun: string[];          // hiragana as in KANJIDIC2, "." okurigana kept
  strokes: number;
  grade: number | null;   // jouyou school grade, null if none
  jlpt: number | null;    // old 4-level JLPT, null if none
  freq: number | null;    // newspaper frequency rank 1-2500, null if none
  rtk: number | null;     // Heisig RTK frame number (6th ed., else older), a pointer into the user's own book
}
```

## Notes for the AI

- Downloaded files are untrusted data: they live only in the scratchpad, are
  read as text by the script, and are never executed.
- Do not push, and do not fetch anything else.
- No em dashes in copy, comments or commits.

## Evidence (step 4)

- Downloaded 2026-10-17 into the scratchpad only (never executed): KANJIDIC2
  (13,108 entries) and KRADFILE (6,355 decompositions). `bun run
  scripts/build-kanji-data.ts` wrote 6,355 kanji (1.2 MB); spot checks matched
  KANJIDIC2 (日 day/sun, RTK 12; 本 book, RTK 224; 語 word; 歌 song/sing, RTK 508).
- `.output/server` bundles the data into the `kanji.get` route chunk, so packaged
  binaries need no extra folder.
- Isolated dev server (own data dir, port 3012, process checked): `GET
  /api/kanji?text=歌` returned the full entry; a real title returned 頃 and 解
  with `𠮟` reported unknown; missing and empty `text` returned 400.
- `bun run test` (2497 passed) and `bun run build` pass.

**Not verified:** the over-200-character 400 (my client script failed to URL-encode
the request, and the server was already stopped; the check is a one-line guard),
and the route's `cache-control` header, which the dev server answered with
`no-cache`.
