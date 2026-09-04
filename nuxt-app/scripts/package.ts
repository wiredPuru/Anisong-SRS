import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

interface Target {
  label: string;
  bunTarget: string;
  binaryName: string;
}

const TARGETS: Target[] = [
  { label: "windows-x64", bunTarget: "bun-windows-x64", binaryName: "gaq-srs.exe" },
  { label: "macos-x64", bunTarget: "bun-darwin-x64", binaryName: "gaq-srs" },
  { label: "macos-arm64", bunTarget: "bun-darwin-arm64", binaryName: "gaq-srs" },
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
