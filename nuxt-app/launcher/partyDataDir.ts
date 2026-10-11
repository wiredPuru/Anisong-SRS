import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

function dbSize(dir: string): number {
  const file = join(dir, "gaq-srs.db");
  if (!existsSync(file)) return -1;
  let size = statSync(file).size;
  const wal = `${file}-wal`;
  if (existsSync(wal)) size += statSync(wal).size;
  return size;
}

/**
 * Run from source, the SRS may have been started with `bun run dev`, which keeps
 * its database in the project's `.data` folder, while a packaged install uses
 * the user-data folder. Party mode should play the library the user actually has,
 * so with no explicit folder it takes whichever of the two holds the bigger database.
 */
export function pickPartyDataDir(userDataDir: string, devDataDir: string): string {
  return dbSize(devDataDir) > dbSize(userDataDir) ? devDataDir : userDataDir;
}
