import { basename } from "node:path";
import { applyServerEnv, isCompiled, openBrowser, realDir, startBuiltServer, waitForServer } from "./serverEnv.ts";
import { removeUpdateLeftovers } from "./updateCleanup.ts";

// Self-update (feature 82) is offered only when this is set, so dev and
// `bun run launch` never replace their own files.
if (isCompiled) process.env.GAQ_SRS_INSTALL_DIR = realDir;

applyServerEnv();

process.env.PORT ??= "3000";
// This unauthenticated app must never inherit a public listener address.
process.env.NITRO_HOST = "127.0.0.1";
process.env.HOST = "127.0.0.1";
const url = `http://127.0.0.1:${process.env.NITRO_PORT || process.env.PORT}/`;

await startBuiltServer();

const ready = await waitForServer(url);
if (!ready) {
  console.error(`Server did not become reachable at ${url} in time.`);
  process.exit(1);
}

console.log(`GAQ SRS is running at ${url}`);
// A self-update relaunch sets this: the page that asked for the update is
// still open and reloads itself.
if (process.env.GAQ_SRS_SKIP_BROWSER !== "1") openBrowser(url);

// Only once the new build answers: if it cannot start, the previous build's
// `.old` files are still there to recover by hand.
if (isCompiled) await removeUpdateLeftovers(realDir, basename(process.execPath));
