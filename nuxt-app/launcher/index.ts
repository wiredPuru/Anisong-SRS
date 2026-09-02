import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveUserDataDir } from "./userDataDir.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
// A compiled binary resolves import.meta.url into Bun's virtual bundle
// filesystem ("/$bunfs/..."). Its root reports as existing via
// fs.existsSync (it's Bun's own fs shim), so existsSync alone can't
// detect this - check the prefix directly and fall back to the
// executable's real on-disk directory. Uncompiled, scriptDir is already
// the real launcher/ directory.
const isCompiled = scriptDir.startsWith("/$bunfs");
const realDir = isCompiled ? dirname(process.execPath) : scriptDir;

process.env.GAQ_SRS_DATA_DIR ??= resolveUserDataDir(
  process.platform,
  process.env,
  homedir(),
);

// Dev tree: migrations live at ../server/db/migrations relative to this
// file. Packaged: they ship as a sibling ./migrations folder next to the
// compiled binary instead - migration SQL files are read via fs at
// runtime, not imported, so bun build --compile never embeds them.
const devMigrationsDir = join(realDir, "..", "server", "db", "migrations");
process.env.GAQ_SRS_MIGRATIONS_DIR ??= existsSync(devMigrationsDir)
  ? devMigrationsDir
  : join(realDir, "migrations");

process.env.PORT ??= "3000";
const url = `http://localhost:${process.env.PORT}/`;

// Literal relative path so Bun's bundler can trace and embed this import
// when the launcher itself gets compiled. A compiled binary resolves it
// from its own already-bundled module graph (no real disk check needed);
// uncompiled, a missing build surfaces as a normal import failure below.
try {
  await import("../.output/server/index.mjs");
} catch (err) {
  console.error('Could not start the built server. If this is not a compiled binary, run "bun run build" first.');
  console.error(err);
  process.exit(1);
}

// Nitro resolves its public-asset directory (JS/CSS/favicon) at request
// time from globalThis._importMeta_.url, which the entry module sets to
// its own real import.meta.url on import. A compiled binary collapses
// that to Bun's virtual bundle root ("/$bunfs/..."), so every static
// asset 404s even though the page itself loads. Point it back at a fake
// path under the real sibling `public/` folder shipped next to the
// binary - same pattern as the migrations folder - now that the import
// above has already run and won't overwrite it again. Uncompiled, the
// entry module's own real import.meta.url already resolves correctly, so
// this only runs when compiled.
if (isCompiled) {
  (globalThis as { _importMeta_?: { url: string; env: NodeJS.ProcessEnv } })._importMeta_ = {
    url: pathToFileURL(join(realDir, "server", "index.mjs")).toString(),
    env: process.env,
  };
}

async function waitForServer(maxAttempts = 60, delayMs = 250): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

const ready = await waitForServer();
if (!ready) {
  console.error(`Server did not become reachable at ${url} in time.`);
  process.exit(1);
}

console.log(`GAQ SRS is running at ${url}`);
openBrowser(url);

function openBrowser(targetUrl: string): void {
  const command =
    process.platform === "darwin"
      ? ["open", targetUrl]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", targetUrl]
        : ["xdg-open", targetUrl];
  Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
}
