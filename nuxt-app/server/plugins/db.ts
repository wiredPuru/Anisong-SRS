import { dirname } from "node:path";
import { DB_PATH, runMigrations } from "../db/client.ts";
import { resolveMigrationsFolder } from "../db/dataDir.ts";
import { ensureDefaultLibraryFolder } from "../utils/mediaLibrary.ts";

export default defineNitroPlugin(() => {
  runMigrations(resolveMigrationsFolder(process.env));
  ensureDefaultLibraryFolder(dirname(DB_PATH));
});
