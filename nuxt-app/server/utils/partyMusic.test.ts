import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMusicFile, listPartyMusic } from "./partyMusic.ts";

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

describe("listPartyMusic", () => {
  it("reads library folders, skipping downloaded clips and video", () => {
    const root = mkdtempSync(join(tmpdir(), "gaq-music-"));
    const library = join(root, "lib");
    mkdirSync(join(library, "party-music"), { recursive: true });
    writeFileSync(join(library, "chill.mp3"), "x");
    writeFileSync(join(library, "Show - OP1 - Artist.mp3"), "x");
    writeFileSync(join(library, "clip.webm"), "x");
    writeFileSync(join(library, "party-music", "vibes.webm"), "x");
    process.env.GAQ_SRS_DATA_DIR = join(root, "data");
    mkdirSync(join(root, "data"), { recursive: true });
    const { tracks } = listPartyMusic([library]);
    expect(tracks).toEqual(["chill.mp3", "vibes.webm"]);
  });
});
