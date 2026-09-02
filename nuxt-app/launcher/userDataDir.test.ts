import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUserDataDir } from "./userDataDir.ts";

const HOME = "/home/someone";

describe("resolveUserDataDir", () => {
  it("uses APPDATA on Windows when set", () => {
    const result = resolveUserDataDir(
      "win32",
      { APPDATA: "C:/Users/someone/AppData/Roaming" },
      HOME,
    );
    expect(result).toBe(join("C:/Users/someone/AppData/Roaming", "gaq-srs"));
  });

  it("falls back to homeDir/AppData/Roaming on Windows when APPDATA is unset", () => {
    const result = resolveUserDataDir("win32", {}, HOME);
    expect(result).toBe(join(HOME, "AppData/Roaming", "gaq-srs"));
  });

  it("uses Library/Application Support on macOS", () => {
    const result = resolveUserDataDir("darwin", {}, HOME);
    expect(result).toBe(join(HOME, "Library/Application Support", "gaq-srs"));
  });

  it("uses XDG_DATA_HOME on Linux when set", () => {
    const result = resolveUserDataDir(
      "linux",
      { XDG_DATA_HOME: "/custom/data" },
      HOME,
    );
    expect(result).toBe(join("/custom/data", "gaq-srs"));
  });

  it("falls back to homeDir/.local/share on Linux when XDG_DATA_HOME is unset", () => {
    const result = resolveUserDataDir("linux", {}, HOME);
    expect(result).toBe(join(HOME, ".local/share", "gaq-srs"));
  });
});
