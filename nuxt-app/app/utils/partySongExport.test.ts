import { describe, expect, it } from "vitest";
import { songLogFileName, songLogToCsv } from "./partySongExport";

describe("songLogToCsv", () => {
  it("writes a header and the songs oldest first", () => {
    const csv = songLogToCsv([
      { number: 2, anime: "B", song: "Two", artist: "Y", scored: false },
      { number: 1, anime: "A", song: "One", artist: "X", scored: true },
    ]);
    expect(csv.split("\r\n")).toEqual(["#,Anime,Song,Artist,I scored", "1,A,One,X,yes", "2,B,Two,Y,no"]);
  });

  it("quotes commas, quotes and newlines", () => {
    const csv = songLogToCsv([{ number: 1, anime: 'Say "hi", ok', song: "a\nb", artist: "", scored: false }]);
    expect(csv.split("\r\n")[1]).toBe('1,"Say ""hi"", ok","a\nb",,no');
  });

  it("is just the header for an empty log", () => {
    expect(songLogToCsv([])).toBe("#,Anime,Song,Artist,I scored");
  });
});

describe("songLogFileName", () => {
  it("uses the local date", () => {
    expect(songLogFileName(new Date(2026, 9, 10))).toBe("party-songs-2026-10-10.csv");
  });
});
