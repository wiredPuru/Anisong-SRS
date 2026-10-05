import { describe, expect, it } from "vitest";
import { buildSessionLogCsv, sessionLogFileName, type SessionLogExportEntry } from "./sessionLogExport";

function entry(overrides: Partial<SessionLogExportEntry["card"]> = {}, result: "pass" | "fail" = "pass"): SessionLogExportEntry {
  return {
    result,
    card: {
      songTitle: "Puzzle",
      artistName: "KOTOKO",
      animeTitleEnglish: "The Faraway Paladin",
      animeTitleRomaji: "Saihate no Paladin",
      animeTitleNative: "最果てのパラディン",
      themeSlot: "ED1",
      ...overrides,
    },
  };
}

describe("buildSessionLogCsv", () => {
  it("writes only the header for an empty session", () => {
    expect(buildSessionLogCsv([])).toBe(
      "#,Result,Song,Artist,Anime (English),Anime (Romaji),Anime (Japanese),Theme\r\n",
    );
  });

  it("numbers rows oldest first and labels results", () => {
    const lines = buildSessionLogCsv([entry({ songTitle: "A" }), entry({ songTitle: "B" }, "fail")]).trimEnd().split("\r\n");
    expect(lines[1]).toBe("1,Pass,A,KOTOKO,The Faraway Paladin,Saihate no Paladin,最果てのパラディン,ED1");
    expect(lines[2]).toMatch(/^2,Fail,B,/);
  });

  it("quotes commas, quotes and newlines", () => {
    const csv = buildSessionLogCsv([entry({ songTitle: 'Hello, "World"', artistName: "a\nb" })]);
    expect(csv).toContain('"Hello, ""World"""');
    expect(csv).toContain('"a\nb"');
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(buildSessionLogCsv([entry({ songTitle: "=1+1" })])).toContain(",'=1+1,");
  });

  it("shows an insert song as Insert, not its internal slot", () => {
    expect(buildSessionLogCsv([entry({ themeSlot: "IN-21049" })]).trimEnd()).toMatch(/,Insert$/);
  });
});

describe("sessionLogFileName", () => {
  it("uses the local date and time", () => {
    expect(sessionLogFileName(new Date(2026, 9, 4, 9, 5))).toBe("gaq-session-log-2026-10-04-0905.csv");
  });
});
