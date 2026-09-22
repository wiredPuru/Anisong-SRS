import { describe, expect, it } from "vitest";
import { acquireDownloadGuard, downloadGuardKey, releaseDownloadGuard } from "./downloadGuard.ts";

// Each test uses its own card id - the guard's state is a module-level
// singleton, so reusing an id would leak between tests.
describe("download in-flight guard", () => {
  it("blocks a second concurrent acquire for the same key", () => {
    const key = downloadGuardKey(1, "video");
    expect(acquireDownloadGuard(key)).toBe(true);
    expect(acquireDownloadGuard(key)).toBe(false);
  });

  it("frees the key once released, allowing a later sequential download", () => {
    const key = downloadGuardKey(2, "video");
    expect(acquireDownloadGuard(key)).toBe(true);
    releaseDownloadGuard(key);
    expect(acquireDownloadGuard(key)).toBe(true);
  });

  it("does not block a different card or a different kind on the same card", () => {
    expect(acquireDownloadGuard(downloadGuardKey(3, "video"))).toBe(true);
    expect(acquireDownloadGuard(downloadGuardKey(4, "video"))).toBe(true);
    expect(acquireDownloadGuard(downloadGuardKey(3, "audio"))).toBe(true);
  });

  it("releasing an already-free key is a no-op", () => {
    const key = downloadGuardKey(5, "video");
    expect(() => releaseDownloadGuard(key)).not.toThrow();
    expect(acquireDownloadGuard(key)).toBe(true);
  });
});
