# Fix: Drop redundant parts from the kanji parts list

**Type:** Fix
**Status:** verified (bun run test, bun run build, live curl for 花 and 魔)

## The problem

The parts shown for a kanji come straight from KRADFILE, which lists every shape
anywhere in the character. So a part that is already inside another listed part
shows twice: 花 lists 化 (change), 匕 (spoon) and 艾 (moxa), though 匕 is part
of 化; 魔 lists 8 parts, including 田, 儿, 匕 and 厶 that are inside 鬼, and 木
and 广 that are inside 麻. It reads as wrong against RTK's two-piece view of 花.

## The fix

In `lookupKanji` (`nuxt-app/server/utils/kanjiLookup.ts`, the one place the API
and the Kanji deck both read `parts` from), prune each entry's `parts`: drop a
part `p` when another listed part `q` contains `p` in its own dictionary `parts`
and `p` does not contain `q`. Keep the rest in their original order, and keep
shapes with no dictionary entry unless some other part contains them. Done in a
small pure helper, `pruneNestedParts(parts, partsOf)`, so it can be tested
without the data file.

Must not break: the kanji's own char staying in its parts (it is filtered at
display time as today), the part order, stroke-shape parts with no entry, and
`partInfo` in `kanjiCards.ts` (it maps over `entry.parts`, so it follows).
Out of scope: replacing KRADFILE, or mapping 艾 to the grass radical 艹.

## Build steps

- [x] **Step 1 - Prune nested parts** - add `pruneNestedParts` and use it in
  `lookupKanji`, with tests in `kanjiLookup.test.ts`: 花 becomes `化, 艾`
  (匕 dropped), 魔 loses 田, 儿, 匕, 厶, 木 and 广, a part with no entry is kept
  when nothing contains it, two parts that contain each other are both kept, and
  a single-part kanji is unchanged. *Done when:* `bun run test` passes, and
  `curl "localhost:3000/api/kanji?text=花魔"` shows the shorter parts.

## Verify

Open `/kanji` (reveal 花) and the Japanese breakdown on Study: 花 shows change
and moxa only, and 魔 shows far fewer parts, with no spoon under 花.
