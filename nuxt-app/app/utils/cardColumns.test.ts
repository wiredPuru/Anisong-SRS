import { describe, expect, it } from "vitest";
import {
  clampSongShare,
  DEFAULT_SONG_SHARE,
  MIN_TEXT_COLUMN_PX,
  parseStoredSongShare,
  songShareFromPointer,
} from "./cardColumns.ts";

describe("clampSongShare", () => {
  it("keeps a share that leaves both columns room", () => {
    expect(clampSongShare(0.6, 1000)).toBe(0.6);
  });

  it("stops the Song column at its minimum width", () => {
    expect(clampSongShare(0.01, 1000)).toBe(MIN_TEXT_COLUMN_PX / 1000);
  });

  it("stops the Anime column at its minimum width", () => {
    expect(clampSongShare(0.99, 1000)).toBeCloseTo(1 - MIN_TEXT_COLUMN_PX / 1000);
  });

  it("uses the default when the area cannot fit two minimums", () => {
    expect(clampSongShare(0.8, MIN_TEXT_COLUMN_PX * 2 - 1)).toBe(DEFAULT_SONG_SHARE);
  });

  it("splits an area of exactly two minimums evenly", () => {
    expect(clampSongShare(0.9, MIN_TEXT_COLUMN_PX * 2)).toBe(0.5);
  });

  it("uses the default for a non-finite share or width", () => {
    expect(clampSongShare(Number.NaN, 1000)).toBe(DEFAULT_SONG_SHARE);
    expect(clampSongShare(0.6, Number.POSITIVE_INFINITY)).toBe(DEFAULT_SONG_SHARE);
  });
});

describe("songShareFromPointer", () => {
  it("turns a pointer position into a share of the area", () => {
    expect(songShareFromPointer(400, 100, 1000)).toBe(0.3);
  });

  it("clamps a pointer dragged past either edge", () => {
    expect(songShareFromPointer(-500, 100, 1000)).toBe(MIN_TEXT_COLUMN_PX / 1000);
    expect(songShareFromPointer(5000, 100, 1000)).toBeCloseTo(1 - MIN_TEXT_COLUMN_PX / 1000);
  });

  it("uses the default for an empty area", () => {
    expect(songShareFromPointer(400, 100, 0)).toBe(DEFAULT_SONG_SHARE);
  });
});

describe("parseStoredSongShare", () => {
  it("reads a stored fraction", () => {
    expect(parseStoredSongShare("0.7")).toBe(0.7);
  });

  it("uses the default for missing, blank, or non-numeric values", () => {
    expect(parseStoredSongShare(null)).toBe(DEFAULT_SONG_SHARE);
    expect(parseStoredSongShare("")).toBe(DEFAULT_SONG_SHARE);
    expect(parseStoredSongShare("wide")).toBe(DEFAULT_SONG_SHARE);
  });

  it("uses the default for values outside 0 to 1", () => {
    expect(parseStoredSongShare("0")).toBe(DEFAULT_SONG_SHARE);
    expect(parseStoredSongShare("1")).toBe(DEFAULT_SONG_SHARE);
    expect(parseStoredSongShare("-0.2")).toBe(DEFAULT_SONG_SHARE);
    expect(parseStoredSongShare("450")).toBe(DEFAULT_SONG_SHARE);
  });
});
