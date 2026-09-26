import { describe, expect, it } from "vitest";
import { parseThemePreference, resolveTheme, THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

describe("parseThemePreference", () => {
  it("keeps a known preference", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("falls back to light for anything else", () => {
    expect(parseThemePreference(null)).toBe("light");
    expect(parseThemePreference("Dark")).toBe("light");
    expect(parseThemePreference(1)).toBe("light");
  });
});

describe("resolveTheme", () => {
  it("ignores the OS for an explicit choice", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("THEME_BOOT_SCRIPT", () => {
  function boot(stored: string | null | Error, osDark: boolean): string | null {
    const attrs: Record<string, string> = {};
    const localStorage = {
      getItem(key: string) {
        if (stored instanceof Error) throw stored;
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    };
    const window = { matchMedia: () => ({ matches: osDark }) };
    const document = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
      },
    };
    new Function("localStorage", "window", "document", THEME_BOOT_SCRIPT)(localStorage, window, document);
    return attrs["data-theme"] ?? null;
  }

  it("applies the stored explicit theme", () => {
    expect(boot("dark", false)).toBe("dark");
    expect(boot("light", true)).toBe("light");
  });

  it("resolves system against the OS scheme", () => {
    expect(boot("system", true)).toBe("dark");
    expect(boot("system", false)).toBe("light");
  });

  it("defaults to light when nothing or junk is stored", () => {
    expect(boot(null, true)).toBe("light");
    expect(boot("purple", true)).toBe("light");
  });

  it("still sets light when storage throws", () => {
    expect(boot(new Error("blocked"), true)).toBe("light");
  });
});
