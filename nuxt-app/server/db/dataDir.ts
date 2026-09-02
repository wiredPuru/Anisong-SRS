import { resolve } from "node:path";

export function resolveDbPath(
  env: { GAQ_SRS_DATA_DIR?: string },
  cwd: string,
): string {
  if (env.GAQ_SRS_DATA_DIR) {
    return resolve(env.GAQ_SRS_DATA_DIR, "gaq-srs.db");
  }
  return resolve(cwd, ".data/gaq-srs.db");
}

export function resolveMigrationsFolder(env: {
  GAQ_SRS_MIGRATIONS_DIR?: string;
}): string {
  return env.GAQ_SRS_MIGRATIONS_DIR ?? "server/db/migrations";
}
