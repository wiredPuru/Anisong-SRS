// Regenerates server/data/kanji.json from the two EDRDG source files:
//   bun run scripts/build-kanji-data.ts <kanjidic2.xml> <kradfile>
// kradfile is EUC-JP; kanjidic2.xml is UTF-8. The generated file is committed,
// so the app and its build never need the network for it.
import { readFileSync, writeFileSync } from "node:fs";
import { buildKanjiData, parseKanjidic, parseKradfile } from "../server/utils/kanjiData.ts";

const [kanjidicPath, kradPath] = process.argv.slice(2);
if (!kanjidicPath || !kradPath) {
  console.error("Usage: bun run scripts/build-kanji-data.ts <kanjidic2.xml> <kradfile>");
  process.exit(1);
}

const kanjidic = parseKanjidic(readFileSync(kanjidicPath, "utf8"));
const kradfile = parseKradfile(new TextDecoder("euc-jp").decode(readFileSync(kradPath)));
const data = buildKanjiData(kanjidic, kradfile);

const outPath = new URL("../server/data/kanji.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(data));
console.log(`kanjidic ${kanjidic.size}, kradfile ${kradfile.size}, wrote ${Object.keys(data.kanji).length} kanji`);
