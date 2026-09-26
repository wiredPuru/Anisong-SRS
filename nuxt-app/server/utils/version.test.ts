import { describe, expect, it } from "vitest";
import {
  isNewerVersion,
  parseReleaseAssets,
  pickDownloadUrl,
  platformAssetName,
} from "./version.ts";

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

describe("platformAssetName", () => {
  it("maps every packaged target to its release zip", () => {
    expect(platformAssetName("win32", "x64")).toBe("gaq-srs-windows-x64.zip");
    expect(platformAssetName("darwin", "x64")).toBe("gaq-srs-macos-x64.zip");
    expect(platformAssetName("darwin", "arm64")).toBe("gaq-srs-macos-arm64.zip");
    expect(platformAssetName("linux", "x64")).toBe("gaq-srs-linux-x64.zip");
  });

  it("returns null for a platform no release is built for", () => {
    expect(platformAssetName("linux", "arm64")).toBeNull();
    expect(platformAssetName("win32", "arm64")).toBeNull();
    expect(platformAssetName("freebsd", "x64")).toBeNull();
  });
});

describe("parseReleaseAssets", () => {
  it("keeps name and download url from each asset", () => {
    expect(
      parseReleaseAssets([
        { name: "gaq-srs-linux-x64.zip", browser_download_url: "https://x/linux.zip", size: 1 },
      ]),
    ).toEqual([{ name: "gaq-srs-linux-x64.zip", url: "https://x/linux.zip" }]);
  });

  it("drops malformed entries and non-array input", () => {
    expect(parseReleaseAssets(undefined)).toEqual([]);
    expect(parseReleaseAssets("nope")).toEqual([]);
    expect(
      parseReleaseAssets([null, 3, { name: "a.zip" }, { name: 1, browser_download_url: "u" }]),
    ).toEqual([]);
  });
});

describe("pickDownloadUrl", () => {
  const assets = [
    { name: "gaq-srs-macos-arm64.zip", url: "https://x/arm.zip" },
    { name: "gaq-srs-windows-x64.zip", url: "https://x/win.zip" },
  ];

  it("returns the asset matching the running platform", () => {
    expect(pickDownloadUrl(assets, "darwin", "arm64")).toBe("https://x/arm.zip");
    expect(pickDownloadUrl(assets, "win32", "x64")).toBe("https://x/win.zip");
  });

  it("returns null when the release lacks this platform's zip", () => {
    expect(pickDownloadUrl(assets, "linux", "x64")).toBeNull();
  });

  it("returns null for an unsupported platform even if assets exist", () => {
    expect(pickDownloadUrl(assets, "linux", "arm64")).toBeNull();
  });
});
