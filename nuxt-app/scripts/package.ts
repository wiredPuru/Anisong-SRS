import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkPackagedVersion } from "./versionGuard.ts";

interface Target {
  label: string;
  bunTarget: string;
  binaryName: string;
  // macOS only: bun build --compile appends its payload after the linker
  // ad-hoc-signs the Mach-O, leaving a signature that no longer matches the
  // file. Gatekeeper ignores that for local files, but a browser download
  // carries com.apple.quarantine, and evaluating a broken signature makes
  // macOS report the binary as "damaged" and offer only "Move to Trash".
  // Re-signing after the fact is what keeps a downloaded build launchable.
  needsCodesign?: boolean;
}

const TARGETS: Target[] = [
  { label: "windows-x64", bunTarget: "bun-windows-x64", binaryName: "gaq-srs.exe" },
  { label: "macos-x64", bunTarget: "bun-darwin-x64", binaryName: "gaq-srs", needsCodesign: true },
  { label: "macos-arm64", bunTarget: "bun-darwin-arm64", binaryName: "gaq-srs", needsCodesign: true },
  { label: "linux-x64", bunTarget: "bun-linux-x64", binaryName: "gaq-srs" },
];

const SERVER_ENTRY = ".output/server/index.mjs";
const LAUNCHER_ENTRY = "launcher/index.ts";
const MIGRATIONS_DIR = "server/db/migrations";
const PUBLIC_DIR = ".output/public";
const RELEASE_ROOT = "release";
const KUROMOJI_ENTRY = "node_modules/kuromoji/src/kuromoji.js";
const KUROMOJI_DICT_DIR = "node_modules/kuromoji/dict";

if (!existsSync(SERVER_ENTRY)) {
  console.error(`${SERVER_ENTRY} not found. Run "bun run build" first.`);
  process.exit(1);
}

// Walks .output/server for the appVersion nuxt build baked into runtimeConfig,
// rather than reading one known chunk path, so a Nitro reshuffle degrades to
// "could not read" instead of silently comparing against nothing.
function findBakedVersion(dir: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBakedVersion(path);
      if (found) return found;
      continue;
    }
    if (!entry.name.endsWith(".mjs")) continue;
    const match = readFileSync(path, "utf8").match(/"appVersion"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function readHeadTag(): string | null {
  try {
    const proc = Bun.spawnSync(["git", "tag", "--points-at", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) return null;
    // Several tags can point at one commit; only a version-shaped one matters.
    return (
      proc.stdout
        .toString()
        .split("\n")
        .map((line) => line.trim())
        .find((line) => /^v?\d+(\.\d+)*$/.test(line)) ?? null
    );
  } catch {
    return null;
  }
}

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version as string;
const versionCheck = checkPackagedVersion({
  packageVersion,
  bakedVersion: findBakedVersion(".output/server"),
  headTag: readHeadTag(),
});

if (!versionCheck.ok) {
  console.error(versionCheck.message);
  process.exit(1);
}
console.log(versionCheck.message);

// Nitro's Node-targeted dependency pruning drops files Bun's --compile
// bundler needs from @vue/shared and sibling packages' conditional exports
// maps (their ./index.js entry point is real, just unused by Node's own
// resolution). Restoring the full installs fixes every target, since
// .output/server itself isn't target-specific - only the compiled binary is.
for (const pkg of ["@vue", "vue"]) {
  const dest = join(".output/server/node_modules", pkg);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join("node_modules", pkg), dest, { recursive: true });
}

const results: { label: string; ok: boolean }[] = [];

for (const target of TARGETS) {
  console.log(`\nBuilding ${target.label}...`);
  const releaseDir = join(RELEASE_ROOT, target.label);
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });

  const outfile = join(releaseDir, target.binaryName);
  const proc = Bun.spawnSync(
    [
      "bun",
      "build",
      "--compile",
      `--target=${target.bunTarget}`,
      `--outfile=${outfile}`,
      LAUNCHER_ENTRY,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );

  if (proc.exitCode !== 0) {
    console.error(`Failed to build ${target.label}.`);
    results.push({ label: target.label, ok: false });
    continue;
  }

  // Verified, not assumed: --verify is the exact check that fails on Bun's
  // own output, so running it here is what stops this from silently rotting
  // back to shipping a build macOS calls damaged. A failure fails the target
  // rather than warning, because an unsigned macOS binary is broken output.
  // Note this does make macOS targets buildable only from a Mac, since
  // codesign ships with the Xcode command line tools; the Windows and Linux
  // targets still cross-compile from anywhere.
  if (target.needsCodesign) {
    let signExit: number | null = null;
    try {
      signExit = Bun.spawnSync(["codesign", "--force", "--sign", "-", outfile], {
        stdout: "inherit",
        stderr: "inherit",
      }).exitCode;
    } catch {
      console.error('Could not run "codesign" - macOS targets must be packaged on macOS.');
    }

    const verified =
      signExit === 0 &&
      Bun.spawnSync(["codesign", "--verify", outfile], { stdout: "inherit", stderr: "inherit" })
        .exitCode === 0;

    if (!verified) {
      console.error(`Failed to ad-hoc sign ${target.label}.`);
      results.push({ label: target.label, ok: false });
      continue;
    }
  }

  cpSync(MIGRATIONS_DIR, join(releaseDir, "migrations"), { recursive: true });
  cpSync(PUBLIC_DIR, join(releaseDir, "public"), { recursive: true });

  // kuromoji breaks under bun build --compile: its own require("async")/
  // require("doublearray")/etc. can't resolve via real node_modules
  // directory-walking from inside a compiled binary (verified directly -
  // works fine under plain `bun run`, fails only compiled). Pre-bundling it
  // into one self-contained file flattens that whole dependency tree away,
  // so nothing is left to resolve at runtime. Shipped as a sibling asset
  // (bundle + the real, Nitro-unpruned dict/ folder) exactly like
  // migrations/ and public/ above; furigana.ts loads it via a genuinely
  // dynamic import() of this real disk path.
  const kuromojiDir = join(releaseDir, "kuromoji");
  mkdirSync(kuromojiDir, { recursive: true });
  const kuromojiBuild = Bun.spawnSync(
    [
      "bun",
      "build",
      KUROMOJI_ENTRY,
      "--target=node",
      "--format=cjs",
      `--outfile=${join(kuromojiDir, "kuromoji-bundled.cjs")}`,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (kuromojiBuild.exitCode !== 0) {
    console.error(`Failed to bundle kuromoji for ${target.label}.`);
    results.push({ label: target.label, ok: false });
    continue;
  }
  cpSync(KUROMOJI_DICT_DIR, join(kuromojiDir, "dict"), { recursive: true });

  // Deleted first so a stale archive from an earlier run can't survive a
  // failed rebuild and get uploaded as if it were current.
  const archiveName = `gaq-srs-${target.label}.zip`;
  rmSync(join(RELEASE_ROOT, archiveName), { force: true });

  // Shelling out to zip, rather than bundling a JS zip library, is what
  // keeps the unix exec bit on the binary - a library would have to set the
  // entry's external attributes by hand to match. Zipping "." from inside
  // the target folder stores paths flat, so the archive unzips to the
  // binary and its three sibling folders side by side, which is what the
  // published release instructions tell people to expect.
  let zipExit: number | null = null;
  try {
    zipExit = Bun.spawnSync(["zip", "-qry", join("..", archiveName), ".", "-x", "*.DS_Store"], {
      cwd: releaseDir,
      stdout: "inherit",
      stderr: "inherit",
    }).exitCode;
  } catch {
    console.error('Could not run "zip" - is it installed and on PATH?');
  }

  if (zipExit !== 0) {
    console.error(`Failed to archive ${target.label}.`);
    results.push({ label: target.label, ok: false });
    continue;
  }

  results.push({ label: target.label, ok: true });
}

console.log("\nRelease summary:");
for (const result of results) {
  console.log(`  ${result.ok ? "OK" : "FAILED"}  ${result.label}`);
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}
