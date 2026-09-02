# Fix: Furigana broken in the packaged standalone binary

**Type:** Fix
**Status:** verified

## The problem

Japanese Furigana display (`/api/furigana`) was completely broken in the
packaged standalone binary (build item 48), on every platform - reproduced
and root-caused on macOS in this session, not just the Windows report that
started this investigation.

Two separate bugs compounded:

1. **Bun `--compile` bakes a build-machine absolute path into `kuromoji`'s
   require.** `server/utils/furigana.ts` used `kuroshiro-analyzer-kuromoji`,
   which internally does `require("kuromoji")` and
   `require.resolve("kuromoji")`. Under `bun build --compile`, this didn't
   get truly embedded - Bun left it as a runtime require against the
   literal absolute disk path resolved at *build* time. That path only
   happened to exist on the exact machine that ran the build; anywhere else
   it failed outright with `Cannot find module '.../kuromoji/src/kuromoji.js'`
   - the exact error from the Windows report.

2. **Nitro prunes `kuromoji`'s `dict/` folder from `.output/server/node_modules`.**
   The dictionary data files (`*.dat.gz`) are only ever read via runtime
   `fs` calls, invisible to Nitro's static dependency trace, so they never
   made it into the production server output - independently broke furigana
   with `ENOENT: ... kuromoji/dict/unk_compat.dat.gz`.

Isolated testing this session (Bun 1.4.0, macOS arm64) ruled out the
straightforward fixes:

- `bun build --compile --external kuromoji` does not help: the compiled
  binary resolves external bare specifiers from its virtual `/$bunfs/root`
  bundle root, which has no real disk ancestor, so a real sibling
  `node_modules/kuromoji` next to the exe is never found, regardless of
  `cwd` or `NODE_PATH`.
- A genuinely dynamic `import()` or `createRequire()` of the real,
  unbundled `kuromoji` package (shipped as a real sibling folder) loaded the
  top-level module fine, but its own internal bare-specifier requires
  (`require("async")`, `require("doublearray")`, etc.) failed to resolve.
  This reproduced only under `bun build --compile`; the identical code
  worked fine under plain `bun run`.
- The pre-built browser bundle at
  `kuroshiro-analyzer-kuromoji/dist/kuroshiro-analyzer-kuromoji.js` loaded
  cleanly (fully self-contained) but was browserified with the browser
  (`XMLHttpRequest`-based) dictionary loader baked in permanently -
  unusable under Bun/Node.

## The fix

Validated end-to-end, including a full relocation test (bundle + dict
copied to a fresh path, run from an unrelated `cwd` - still worked):

1. **Pre-bundle kuromoji into one self-contained file.**
   `bun build node_modules/kuromoji/src/kuromoji.js --target=node
   --format=cjs` flattens kuromoji's entire dependency tree (`async`,
   `doublearray`, `zlibjs`, `lodash`) into one file with the real,
   Node-targeted `fs`-based dictionary loader. Nothing is left to resolve
   via `require()` at runtime, so it survives being loaded from outside the
   compiled bundle.
2. **Ship that bundle plus the real, unpruned `dict/` folder as sibling
   assets next to each packaged binary** (`scripts/package.ts`), the same
   pattern already used for `migrations/` and `public/`.
3. **Load the bundle via a genuinely dynamic `import()` of a real disk
   path at runtime**, computed the same way `GAQ_SRS_MIGRATIONS_DIR` already
   is in `launcher/index.ts`.
4. **A small custom analyzer class** (`CompiledKuromojiAnalyzer`,
   `init()`/`parse()`, matching `kuroshiro`'s duck-typed analyzer interface)
   wraps the dynamically-loaded kuromoji module's `builder({dicPath}).build()`,
   mirroring what `kuroshiro-analyzer-kuromoji`'s own `lib/index.js` does
   internally.
5. `server/utils/furigana.ts` picks the custom analyzer only when the
   packaged sibling assets are present (both env vars set); otherwise it
   keeps using `kuroshiro-analyzer-kuromoji`'s own `KuromojiAnalyzer`
   unchanged for `bun run dev`. For `bun run launch` (launcher, but not
   compiled), only the dict-pruning bug applies, handled by passing an
   explicit `dictPath` into the normal `KuromojiAnalyzer`.

**Known limitation:** `bun run preview` (Nuxt/Nitro's own preview command,
unrelated to `launcher/index.ts`) was not wired into this fix and may
remain affected by the dict-pruning bug alone - it was not part of the
original report and isn't part of the packaging feature's surface.

## Build steps

- [x] Add a kuromoji pre-bundle + dict-copy step to `scripts/package.ts`.
- [x] Add `GAQ_SRS_KUROMOJI_BUNDLE` / `GAQ_SRS_KUROMOJI_DICT_DIR` env var
  resolution to `launcher/index.ts`.
- [x] Add the `CompiledKuromojiAnalyzer` class and analyzer-selection logic
  to `server/utils/furigana.ts`.

## Verify

- Automated: `bun run build && bun run package` succeeds for all four
  targets, each with a populated `kuromoji/kuromoji-bundled.cjs` +
  `kuromoji/dict/` sibling folder.
- Manual (macOS, relocation test): copied the rebuilt macOS binary and its
  sibling assets to `/tmp/gaq-relocated`, ran from an unrelated `cwd` with a
  clean `GAQ_SRS_DATA_DIR` - `curl .../api/furigana?text=今日は良い天気です`
  returned real `<ruby>` furigana markup, not a 500.
- Manual (dev regression check): same query against `bun run dev` returned
  identical correct output - unaffected.
- Manual (Windows, still needed): the user re-copies the rebuilt
  `release/windows-x64/` folder (now including the `kuromoji/` sibling
  folder) to a Windows machine and confirms the Furigana toggle works
  there too.
