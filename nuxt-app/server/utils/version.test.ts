import { describe, expect, it } from "vitest";
import { isNewerVersion } from "./version.ts";

describe("isNewerVersion", () => {
  it("treats a higher minor as newer even when it has more digits", () => {
    // The reason this function exists rather than a string compare:
    // "1.10.0" < "1.9.0" lexically, which would hide every release past x.9.
    expect(isNewerVersion("v1.10.0", "1.9.0")).toBe(true);
  });

  it("is false for the same version", () => {
    expect(isNewerVersion("v1.2.0", "1.2.0")).toBe(false);
  });

  it("is false when the running version is ahead of the release", () => {
    expect(isNewerVersion("v1.2.0", "1.3.0")).toBe(false);
  });

  it("compares the patch segment", () => {
    expect(isNewerVersion("1.2.1", "1.2.0")).toBe(true);
  });

  it("ignores a leading v on either side", () => {
    expect(isNewerVersion("v2.0.0", "v1.99.99")).toBe(true);
  });

  it("treats a missing segment as zero rather than as smaller", () => {
    expect(isNewerVersion("v1.2", "1.2.0")).toBe(false);
    expect(isNewerVersion("v1.3", "1.2.9")).toBe(true);
  });

  it("returns false for unparseable input instead of throwing", () => {
    expect(isNewerVersion("", "1.2.0")).toBe(false);
    expect(isNewerVersion("not-a-version", "1.2.0")).toBe(false);
    expect(isNewerVersion("v1.2.0", "")).toBe(false);
    expect(isNewerVersion("v1.x.0", "1.2.0")).toBe(false);
  });
});
