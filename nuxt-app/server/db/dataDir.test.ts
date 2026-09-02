import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDbPath, resolveMigrationsFolder } from "./dataDir.ts";

describe("resolveDbPath", () => {
  it("uses today's project-relative path when GAQ_SRS_DATA_DIR is unset", () => {
    const result = resolveDbPath({}, "/repo/nuxt-app");
    expect(result).toBe(resolve("/repo/nuxt-app", ".data/gaq-srs.db"));
  });

  it("uses GAQ_SRS_DATA_DIR as the base directory when set", () => {
    const result = resolveDbPath(
      { GAQ_SRS_DATA_DIR: "/Users/someone/Library/Application Support/gaq-srs" },
      "/repo/nuxt-app",
    );
    expect(result).toBe(
      resolve(
        "/Users/someone/Library/Application Support/gaq-srs",
        "gaq-srs.db",
      ),
    );
  });
});

describe("resolveMigrationsFolder", () => {
  it("uses today's relative migrations folder when GAQ_SRS_MIGRATIONS_DIR is unset", () => {
    expect(resolveMigrationsFolder({})).toBe("server/db/migrations");
  });

  it("uses GAQ_SRS_MIGRATIONS_DIR when set", () => {
    expect(
      resolveMigrationsFolder({
        GAQ_SRS_MIGRATIONS_DIR: "/some/scratch/migrations",
      }),
    ).toBe("/some/scratch/migrations");
  });
});
