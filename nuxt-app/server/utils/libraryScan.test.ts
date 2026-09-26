import { describe, expect, it } from "vitest";
import {
  clipKindForFile,
  matchKey,
  parseFileKey,
  parseRecoverBody,
  planLibraryScan,
  RECOVER_MAX_PATHS,
  selectRecoverActions,
  type ScanCard,
  type ScanSong,
} from "./libraryScan.ts";

const LIB = "/lib";

function song(songId: number, animeTitleRomaji: string, themeSlot: string, artistName: string): ScanSong {
  return { songId, songTitle: `Song ${songId}`, animeTitleRomaji, themeSlot, artistName };
}

const GOLDEN_OP1 = song(1, "Golden Time", "OP1", "Yui Horie");
const GOLDEN_ED1 = song(2, "Golden Time", "ED1", "Yui Horie");
const KAMPFER = song(3, "Kämpfer", "OP1", "Yui Horie");

function plan(files: string[], songs: ScanSong[], cards: ScanCard[] = []) {
  return planLibraryScan({ files, songs, cards });
}

describe("clipKindForFile", () => {
  it("maps video and audio extensions case-insensitively", () => {
    expect(clipKindForFile("a.webm")).toBe("video");
    expect(clipKindForFile("a.MP4")).toBe("video");
    expect(clipKindForFile("a.mp3")).toBe("audio");
    expect(clipKindForFile("a.ogg")).toBe("audio");
  });

  it("ignores anything else", () => {
    expect(clipKindForFile("notes.txt")).toBeNull();
    expect(clipKindForFile(".DS_Store")).toBeNull();
    expect(clipKindForFile("noext")).toBeNull();
  });
});

describe("matchKey / parseFileKey", () => {
  it("builds the same key a download filename would carry", () => {
    expect(parseFileKey(`${LIB}/Golden Time - OP1 - Yui Horie.webm`).key).toBe(matchKey(GOLDEN_OP1));
  });

  it("strips characters sanitizeSegment strips", () => {
    const s = song(9, "Fate/kaleid liner Prisma Illya", "ED2", "ChouCho");
    expect(parseFileKey(`${LIB}/Fatekaleid liner Prisma Illya - ED2 - ChouCho.webm`).key).toBe(matchKey(s));
  });

  it("drops one trailing copy suffix and reports its number", () => {
    expect(parseFileKey(`${LIB}/Golden Time - OP1 - Yui Horie (3).webm`)).toEqual({ key: matchKey(GOLDEN_OP1), copy: 3 });
    expect(parseFileKey(`${LIB}/Golden Time - OP1 - Yui Horie.webm`).copy).toBe(1);
  });

  it("treats NFD and NFC names as equal", () => {
    const nfd = `${LIB}/K${"ä"}mpfer - OP1 - Yui Horie.webm`;
    expect(parseFileKey(nfd).key).toBe(matchKey(KAMPFER));
  });

  it("is case-insensitive", () => {
    expect(parseFileKey(`${LIB}/GOLDEN TIME - op1 - yui horie.webm`).key).toBe(matchKey(GOLDEN_OP1));
  });
});

describe("planLibraryScan", () => {
  it("creates a card for a matched song with no card", () => {
    const result = plan([`${LIB}/Golden Time - OP1 - Yui Horie.webm`], [GOLDEN_OP1]);
    expect(result.create).toEqual([{ ...GOLDEN_OP1, videoPath: `${LIB}/Golden Time - OP1 - Yui Horie.webm`, audioPath: null }]);
    expect(result.scannedFiles).toBe(1);
  });

  it("puts a video and an audio file for one song on the same new card", () => {
    const result = plan([`${LIB}/Golden Time - OP1 - Yui Horie.webm`, `${LIB}/Golden Time - OP1 - Yui Horie.mp3`], [GOLDEN_OP1]);
    expect(result.create).toHaveLength(1);
    expect(result.create[0]).toMatchObject({ videoPath: `${LIB}/Golden Time - OP1 - Yui Horie.webm`, audioPath: `${LIB}/Golden Time - OP1 - Yui Horie.mp3` });
  });

  it("counts a file a card already uses and does nothing else with it", () => {
    const path = `${LIB}/Golden Time - OP1 - Yui Horie.webm`;
    const result = plan([path], [GOLDEN_OP1], [{ id: 10, songId: 1, localVideoPath: path, localAudioPath: null }]);
    expect(result).toMatchObject({ scannedFiles: 1, alreadyUsed: 1, create: [], attach: [], skipped: [] });
  });

  it("attaches a file to a card missing a local path of that kind", () => {
    const result = plan(
      [`${LIB}/Golden Time - OP1 - Yui Horie.mp3`],
      [GOLDEN_OP1],
      [{ id: 10, songId: 1, localVideoPath: `${LIB}/other.webm`, localAudioPath: null }],
    );
    expect(result.attach).toEqual([{ ...GOLDEN_OP1, cardId: 10, kind: "audio", path: `${LIB}/Golden Time - OP1 - Yui Horie.mp3` }]);
  });

  it("skips a file whose card already has its own file of that kind as a duplicate", () => {
    const path = `${LIB}/Golden Time - OP1 - Yui Horie (2).webm`;
    const result = plan([path], [GOLDEN_OP1], [{ id: 10, songId: 1, localVideoPath: `${LIB}/Golden Time - OP1 - Yui Horie.webm`, localAudioPath: null }]);
    expect(result.skipped).toEqual([{ path, reason: "duplicate", songTitle: "Song 1" }]);
    expect(result.attach).toEqual([]);
  });

  it("prefers the unsuffixed copy when two files match one song and kind", () => {
    const bare = `${LIB}/Golden Time - OP1 - Yui Horie.webm`;
    const copy = `${LIB}/Golden Time - OP1 - Yui Horie (2).webm`;
    const result = plan([copy, bare], [GOLDEN_OP1]);
    expect(result.create[0]!.videoPath).toBe(bare);
    expect(result.skipped).toEqual([{ path: copy, reason: "duplicate", songTitle: "Song 1" }]);
  });

  it("reports unmatched files", () => {
    const path = `${LIB}/Higurashi no Naku Koro ni Kai - ED1 - anNina.webm`;
    expect(plan([path], [GOLDEN_OP1]).skipped).toEqual([{ path, reason: "unmatched", songTitle: null }]);
  });

  it("never guesses between two songs with the same key", () => {
    const path = `${LIB}/Golden Time - OP1 - Yui Horie.webm`;
    const twin = { ...GOLDEN_OP1, songId: 99 };
    const result = plan([path], [GOLDEN_OP1, twin]);
    expect(result.skipped).toEqual([{ path, reason: "ambiguous", songTitle: null }]);
    expect(result.create).toEqual([]);
  });

  it("ignores non-media files without counting them", () => {
    const result = plan([`${LIB}/Golden Time - OP1 - Yui Horie.txt`, `${LIB}/.DS_Store`], [GOLDEN_OP1]);
    expect(result).toMatchObject({ scannedFiles: 0, create: [], skipped: [] });
  });

  it("matches a file under a different song of the same anime independently", () => {
    const result = plan(
      [`${LIB}/Golden Time - OP1 - Yui Horie.webm`, `${LIB}/Golden Time - ED1 - Yui Horie.webm`],
      [GOLDEN_OP1, GOLDEN_ED1],
    );
    expect(result.create.map((c) => c.songId).sort()).toEqual([1, 2]);
  });
});

describe("parseRecoverBody", () => {
  it("accepts a non-empty list of strings", () => {
    expect(parseRecoverBody({ paths: ["/lib/a.webm"] })).toEqual({ paths: ["/lib/a.webm"] });
  });

  it("rejects a missing, empty, oversized, or mistyped list", () => {
    expect(parseRecoverBody(null)).toHaveProperty("error");
    expect(parseRecoverBody({})).toHaveProperty("error");
    expect(parseRecoverBody({ paths: [] })).toHaveProperty("error");
    expect(parseRecoverBody({ paths: ["/a", 3] })).toHaveProperty("error");
    expect(parseRecoverBody({ paths: [""] })).toHaveProperty("error");
    expect(parseRecoverBody({ paths: Array.from({ length: RECOVER_MAX_PATHS + 1 }, (_, i) => `/lib/${i}.webm`) })).toHaveProperty("error");
  });
});

describe("selectRecoverActions", () => {
  const video = `${LIB}/Golden Time - OP1 - Yui Horie.webm`;
  const audio = `${LIB}/Golden Time - OP1 - Yui Horie.mp3`;
  const attachPath = `${LIB}/Golden Time - ED1 - Yui Horie.mp3`;
  const scan = plan(
    [video, audio, attachPath],
    [GOLDEN_OP1, GOLDEN_ED1],
    [{ id: 20, songId: 2, localVideoPath: `${LIB}/x.webm`, localAudioPath: null }],
  );

  it("acts on every named entry", () => {
    expect(selectRecoverActions(scan, [video, audio, attachPath])).toEqual({
      create: [{ songId: 1, videoPath: video, audioPath: audio }],
      attach: [{ cardId: 20, kind: "audio", path: attachPath }],
      skipped: [],
    });
  });

  it("creates a card with only the named paths", () => {
    expect(selectRecoverActions(scan, [audio]).create).toEqual([{ songId: 1, videoPath: null, audioPath: audio }]);
  });

  it("skips a path the plan does not offer instead of trusting it", () => {
    const result = selectRecoverActions(scan, ["/etc/passwd", video]);
    expect(result.create).toEqual([{ songId: 1, videoPath: video, audioPath: null }]);
    expect(result.skipped).toEqual(["/etc/passwd"]);
  });

  it("does nothing once the plan no longer offers anything", () => {
    const empty = plan([video], [GOLDEN_OP1], [{ id: 1, songId: 1, localVideoPath: video, localAudioPath: null }]);
    expect(selectRecoverActions(empty, [video])).toEqual({ create: [], attach: [], skipped: [video] });
  });
});
