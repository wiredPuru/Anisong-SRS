import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { resolveDbPath } from "./dataDir.ts";
import * as schema from "./schema.ts";

const DB_PATH = resolveDbPath(process.env, process.cwd());

const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// bun:sqlite only resolves under Bun's own engine - dev/preview both run
// the server under a real spawned `node` process, so better-sqlite3 stays
// the driver there. Only a `bun build --compile` binary runs on Bun's own
// engine, where better-sqlite3's native addon crashes Bun's NAPI layer.
async function createDb() {
  if (process.versions.bun) {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
    const sqlite = new Database(DB_PATH);
    sqlite.exec("PRAGMA journal_mode = WAL");
    sqlite.exec("PRAGMA foreign_keys = ON");
    const instance = drizzle(sqlite, { schema });
    return {
      db: instance,
      runMigrations: (migrationsFolder: string) =>
        migrate(instance, { migrationsFolder }),
    };
  }
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const instance = drizzle(sqlite, { schema });
  return {
    db: instance,
    runMigrations: (migrationsFolder: string) =>
      migrate(instance, { migrationsFolder }),
  };
}

const { db, runMigrations } = await createDb();

export { db, runMigrations, DB_PATH };
