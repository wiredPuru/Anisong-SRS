# Fix: Zip the release archives from scripts/package.ts

**Type:** Fix
**Status:** verified

## The problem

`bun run package` cross-compiles all four targets into
`nuxt-app/release/<label>/`, then stops. Turning those folders into the four
uploadable archives is a manual `zip` step, done by hand at release time
(surfaced while cutting v1.1.0).

That matters more than it looks, because the archive names are load-bearing:
every release so far (v1.0.0, v1.1.0) attached exactly
`gaq-srs-windows-x64.zip`, `gaq-srs-macos-x64.zip`, `gaq-srs-macos-arm64.zip`,
and `gaq-srs-linux-x64.zip`, and `README.md` points users at the Releases page
expecting them. A hand-typed name that drifts fails silently - it just puts a
differently-named asset on a public release.

Hand-zipping also has two traps a script gets right every time:

- **The unix exec bit must survive.** The published instructions offer
  `chmod +x` as a fallback; an archive that drops the bit makes it mandatory.
- **macOS sprinkles `.DS_Store`** into any folder that gets opened in Finder,
  and a naive `zip -r` sweeps it into the release asset.

Separately, `AGENTS.md`'s description of this command is stale: it says each
target lands "alongside sibling `migrations/` and `public/` folders", which
predates the packaged-furigana fix that added a third sibling, `kuromoji/`.

## The fix

In `nuxt-app/scripts/package.ts`, after a target's folder is fully assembled
(binary + `migrations/` + `public/` + `kuromoji/`), archive it to
`release/gaq-srs-<label>.zip`.

- **Shell out to `zip`** via `Bun.spawnSync`, matching how this script already
  shells out to `bun build` twice. This is the reason not to reach for a JS zip
  library: the `zip` CLI preserves unix permissions (the exec bit) as a matter
  of course, whereas a JS library needs external-attribute handling to do the
  same - and it avoids adding a dependency for one build-time step.
- **Flat layout** - archive contents at the root (`gaq-srs`, `migrations/`,
  `public/`, `kuromoji/`), not nested under a folder. This matches what the
  published release notes tell users to expect ("keep them side by side").
- **Exclude `.DS_Store`.**
- **Delete any existing archive for that target first**, so a re-run after a
  partial failure can't leave a stale zip from a previous run sitting there to
  be uploaded.
- **Only zip a target that actually compiled** - a target that failed its
  `bun build --compile` already `continue`s before this point and must not get
  an archive.
- **A missing `zip` binary fails that target loudly** (same shape as the
  existing kuromoji-bundle failure path), rather than quietly finishing with no
  archives.

Then update `AGENTS.md`'s package bullet to say the command also emits the four
named archives, and correct the stale sibling list to include `kuromoji/`.

### Must not break

- The per-target `release/<label>/` folders must still be produced exactly as
  today - they are what local testing and manual inspection use.
- Archive names must stay exactly `gaq-srs-<label>.zip` for the four existing
  labels, matching the v1.0.0/v1.1.0 assets already published.
- The script's existing exit behavior: non-zero if any target failed, with the
  same `Release summary:` OK/FAILED lines.

## Build steps

- [x] Add the zip step to `nuxt-app/scripts/package.ts` and update the
  `bun run package` bullet in `AGENTS.md`.
  - Done when: `bun run build && bun run package` leaves four
    `release/gaq-srs-<label>.zip` archives beside the four target folders;
    `unzip -Z release/gaq-srs-macos-arm64.zip gaq-srs` reports `-rwxr-xr-x`;
    `unzip -l` on an archive shows `gaq-srs`, `migrations/`, `public/`, and
    `kuromoji/` at the archive root with no `.DS_Store`; and the four names
    match the assets published on v1.1.0. Confirmed: full clean
    `bun run package` exited 0 with four OK lines; produced names `diff`
    clean against `gh release view v1.1.0` asset names; exec bit
    `-rwxr-xr-x` preserved (an extracted copy ran with no `chmod`);
    archive roots hold exactly the binary plus the three sibling folders;
    0 `.DS_Store` entries across all four. Also verified end-to-end by
    extracting the script-built arm64 archive and running it (`/` -> 200,
    furigana -> `<ruby>音楽<rt>おんがく</rt></ruby>`), and verified the
    stale-archive guard by planting a sentinel file inside an archive and
    confirming a re-run replaced rather than appended to it.

## Verify

- `cd nuxt-app && bun run build && bun run package` - exits 0, prints the
  existing `Release summary:` with four OK lines.
- `ls nuxt-app/release/*.zip` - exactly the four expected names.
- `unzip -Z nuxt-app/release/gaq-srs-macos-arm64.zip gaq-srs` - exec bit
  (`-rwxr-xr-x`) preserved.
- `unzip -l nuxt-app/release/gaq-srs-windows-x64.zip` - `gaq-srs.exe` plus the
  three sibling folders at the root, no `.DS_Store`.
- Re-running `bun run package` a second time overwrites the archives rather
  than appending to or stacking on the previous ones.
