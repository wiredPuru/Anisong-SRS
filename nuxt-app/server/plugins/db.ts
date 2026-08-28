import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../db/client.ts";

export default defineNitroPlugin(() => {
  migrate(db, { migrationsFolder: "server/db/migrations" });
});
