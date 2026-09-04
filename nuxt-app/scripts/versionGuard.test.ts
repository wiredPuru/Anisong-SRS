import { describe, expect, it } from "vitest";
import { checkPackagedVersion } from "./versionGuard.ts";

const MATCHED = { packageVersion: "1.2.0", bakedVersion: "1.2.0", headTag: "v1.2.0" };

describe("checkPackagedVersion", () => {
  it("passes when the build, package.json, and tag all agree", () => {
    const result = checkPackagedVersion(MATCHED);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("1.2.0");
  });

  it("fails on a stale build, naming both versions", () => {
    const result = checkPackagedVersion({ ...MATCHED, bakedVersion: "1.1.0", headTag: null });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("1.1.0");
    expect(result.message).toContain("1.2.0");
  });

  it("reports the stale build first when the tag is also wrong", () => {
    // Rebuilding is the required first move, so it is the more useful message.
    const result = checkPackagedVersion({
      packageVersion: "1.2.0",
      bakedVersion: "1.1.0",
      headTag: "v1.3.0",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Stale build");
  });

  it("fails on a tag mismatch, naming both values", () => {
    const result = checkPackagedVersion({ ...MATCHED, headTag: "v1.3.0" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("v1.3.0");
    expect(result.message).toContain("1.2.0");
  });

  it("accepts a tag written without the v prefix", () => {
    expect(checkPackagedVersion({ ...MATCHED, headTag: "1.2.0" }).ok).toBe(true);
  });

  it("passes when HEAD carries no tag, since tagging follows packaging", () => {
    expect(checkPackagedVersion({ ...MATCHED, headTag: null }).ok).toBe(true);
  });

  it("passes but says so when the baked version could not be read", () => {
    const result = checkPackagedVersion({ ...MATCHED, bakedVersion: null });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("could not read");
  });

  it("still catches a tag mismatch when the baked version is unreadable", () => {
    const result = checkPackagedVersion({
      packageVersion: "1.2.0",
      bakedVersion: null,
      headTag: "v1.3.0",
    });
    expect(result.ok).toBe(false);
  });
});
