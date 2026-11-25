import { describe, expect, it } from "vitest";
import { DISPLAY_THEMES } from "../../server/utils/partyGame";
import { PARTY_THEME_IDS, PARTY_THEMES, partyTheme, partyThemeFontsUrl } from "./partyThemes";

describe("party themes", () => {
  it("lists the same themes as the server, each once", () => {
    expect([...PARTY_THEME_IDS]).toEqual([...DISPLAY_THEMES]);
    expect(PARTY_THEMES.map((theme) => theme.id)).toEqual([...PARTY_THEME_IDS]);
  });

  it("gives every theme its own root class", () => {
    const classes = PARTY_THEMES.map((theme) => theme.rootClass);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("falls back to the default for an unknown or missing id", () => {
    expect(partyTheme("christmas").id).toBe("christmas");
    expect(partyTheme("halloween").id).toBe("neutral");
    expect(partyTheme(null).id).toBe("neutral");
  });

  it("builds one fonts URL, or none when no fonts are needed", () => {
    expect(partyThemeFontsUrl([])).toBeNull();
    expect(partyThemeFontsUrl(["Mochiy Pop One", "DotGothic16"])).toBe(
      "https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=DotGothic16&display=swap",
    );
  });
});
