import { runMigrations } from "../db/client.ts";
import { resolveMigrationsFolder } from "../db/dataDir.ts";

export default defineNitroPlugin(() => {
  runMigrations(resolveMigrationsFolder(process.env));
});
