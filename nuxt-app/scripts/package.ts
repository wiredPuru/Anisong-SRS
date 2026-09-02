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
  results.push({ label: target.label, ok: true });
}

console.log("\nRelease summary:");
for (const result of results) {
  console.log(`  ${result.ok ? "OK" : "FAILED"}  ${result.label}`);
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}
