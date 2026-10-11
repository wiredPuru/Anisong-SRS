import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pickPartyDataDir } from "./partyDataDir.ts";

function folder(bytes: number | null): string {
  const dir = mkdtempSync(join(tmpdir(), "gaq-party-"));
  if (bytes !== null) writeFileSync(join(dir, "gaq-srs.db"), Buffer.alloc(bytes));
  return dir;
}

describe("pickPartyDataDir", () => {
  it("takes the dev folder when its database is bigger", () => {
    const user = folder(100);
    const dev = folder(5000);
    expect(pickPartyDataDir(user, dev)).toBe(dev);
  });

  it("keeps the user-data folder when it is bigger, equal, or the dev one has no database", () => {
    const user = folder(5000);
    expect(pickPartyDataDir(user, folder(100))).toBe(user);
    expect(pickPartyDataDir(user, folder(5000))).toBe(user);
    expect(pickPartyDataDir(user, folder(null))).toBe(user);
  });

  it("takes the dev folder when the user-data folder has no database yet", () => {
    const dev = folder(10);
    expect(pickPartyDataDir(folder(null), dev)).toBe(dev);
  });
});
