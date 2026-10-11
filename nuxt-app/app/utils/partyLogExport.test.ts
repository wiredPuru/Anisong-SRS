import { describe, expect, it } from "vitest";
import { playedLogCsv } from "./partyLogExport";

const answer = (over: Partial<{ animeTitleEnglish: string; songTitle: string; themeSlot: string }> = {}) => ({
  animeTitleEnglish: "Bocchi the Rock!",
  animeTitleRomaji: "Bocchi the Rock!",
  animeTitleNative: "ぼっち",
  songTitle: "Seishun Complex",
  artistName: "Kessoku Band",
  themeSlot: "OP1",
  coverImageUrl: null,
  ...over,
});

describe("playedLogCsv", () => {
  it("lists songs in order under a header", () => {
    const lines = playedLogCsv([{ answer: answer() }, { answer: answer({ songTitle: "Second" }) }]).trim().split("\r\n");
    expect(lines[0]).toBe("#,Anime,Romaji,Song,Artist,Slot");
    expect(lines[1]).toBe("1,Bocchi the Rock!,Bocchi the Rock!,Seishun Complex,Kessoku Band,OP1");
    expect(lines[2]).toContain("2,");
  });

  it("quotes commas and quotes, and never shows an internal insert id", () => {
    const csv = playedLogCsv([{ answer: answer({ songTitle: 'A, "B"', themeSlot: "IN-21049" }) }]);
    expect(csv).toContain('"A, ""B"""');
    expect(csv).not.toContain("21049");
  });
});
