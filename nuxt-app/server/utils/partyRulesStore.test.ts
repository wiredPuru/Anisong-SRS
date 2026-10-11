import { describe, expect, it, vi } from "vitest";
import { loadSavedRules, storeSavedRules } from "./partyRulesStore.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

describe("saved rules", () => {
  it("starts empty, remembers the text, and replaces it", () => {
    expect(loadSavedRules()).toBe("");
    storeSavedRules("Buzz first.\nNo cheating.");
    expect(loadSavedRules()).toBe("Buzz first.\nNo cheating.");
    storeSavedRules("");
    expect(loadSavedRules()).toBe("");
  });
});
