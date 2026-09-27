import { describe, expect, it } from "vitest";
import { isMusicFile } from "./partyMusic.ts";

describe("isMusicFile", () => {
  it("accepts audio files in any case", () => {
    for (const name of ["a.mp3", "b.M4A", "c.ogg", "d.opus", "e.wav", "f.webm", "g.flac"]) {
      expect(isMusicFile(name)).toBe(true);
    }
  });

  it("skips hidden files, other types, and names without an extension", () => {
    for (const name of [".DS_Store", "._a.mp3", "cover.jpg", "notes.txt", "track"]) {
      expect(isMusicFile(name)).toBe(false);
    }
  });
});
