import { describe, expect, it } from "vitest";
import { classifyCardHealth, localFileState, needsAttention, type CardHealthInput } from "./libraryHealth.ts";

const AT_VIDEO = "https://v.animethemes.moe/BocchiTheRock-OP1.webm";
const AT_AUDIO = "https://a.animethemes.moe/BocchiTheRock-OP1.ogg";
const AMQ_VIDEO = "https://naedist.animemusicquiz.com/byvisp.webm";

function input(overrides: Partial<CardHealthInput>): CardHealthInput {
  return {
    localVideoPath: null,
    localAudioPath: null,
    animethemesVideoUrl: null,
    animethemesAudioUrl: null,
    videoState: null,
    audioState: null,
    clipSource: "anisongdb",
    hasDefaultDownloadFolder: true,
    ...overrides,
  };
}

describe("localFileState", () => {
  const exists = (files: string[]) => (path: string) => files.includes(path);

  it("is ok for an existing file inside a library folder", () => {
    expect(localFileState("/lib/a.webm", ["/lib"], exists(["/lib/a.webm"]))).toBe("ok");
  });

  it("is missing for a file inside a library folder that is not on disk", () => {
    expect(localFileState("/lib/a.webm", ["/lib"], exists([]))).toBe("missing");
  });

  it("is outsideLibrary for a sibling folder sharing the prefix", () => {
    expect(localFileState("/lib2/a.webm", ["/lib"], exists(["/lib2/a.webm"]))).toBe("outsideLibrary");
  });

  it("is outsideLibrary for a path that escapes with ..", () => {
    expect(localFileState("/lib/../etc/a.webm", ["/lib"], exists(["/lib/../etc/a.webm"]))).toBe("outsideLibrary");
  });

  it("is outsideLibrary for the folder itself and when no folders are configured", () => {
    expect(localFileState("/lib", ["/lib"], exists(["/lib"]))).toBe("outsideLibrary");
    expect(localFileState("/lib/a.webm", [], exists(["/lib/a.webm"]))).toBe("outsideLibrary");
  });
});

describe("classifyCardHealth", () => {
  it("passes a card with an available local file", () => {
    const health = classifyCardHealth(input({ localVideoPath: "/lib/a.webm", videoState: "ok" }));
    expect(needsAttention(health)).toBe(false);
  });

  it("passes a remote-only card whose host the Clip source allows", () => {
    expect(needsAttention(classifyCardHealth(input({ animethemesVideoUrl: AMQ_VIDEO, clipSource: "anisongdb" })))).toBe(false);
    expect(needsAttention(classifyCardHealth(input({ animethemesVideoUrl: AMQ_VIDEO, clipSource: "both" })))).toBe(false);
    expect(needsAttention(classifyCardHealth(input({ animethemesVideoUrl: AT_VIDEO, clipSource: "animethemes" })))).toBe(false);
  });

  it("offers Re-download and Clear for a missing file with an allowed remote", () => {
    const health = classifyCardHealth(input({
      localVideoPath: "/lib/a.webm", videoState: "missing", animethemesVideoUrl: AMQ_VIDEO,
    }));
    expect(health.localIssues).toEqual([{ kind: "video", problem: "missing", path: "/lib/a.webm" }]);
    expect(health.noPlayableSource).toBe(false);
    expect(health.redownload).toEqual(["video"]);
    expect(health.clear).toEqual(["video"]);
  });

  it("does not offer Re-download when the remote is blocked or no download folder is set", () => {
    const blocked = classifyCardHealth(input({
      localVideoPath: "/lib/a.webm", videoState: "missing", animethemesVideoUrl: AT_VIDEO, clipSource: "anisongdb",
    }));
    expect(blocked.redownload).toEqual([]);
    expect(blocked.noPlayableSource).toBe(true);

    const noFolder = classifyCardHealth(input({
      localVideoPath: "/lib/a.webm", videoState: "missing", animethemesVideoUrl: AMQ_VIDEO, hasDefaultDownloadFolder: false,
    }));
    expect(noFolder.redownload).toEqual([]);
  });

  it("does not offer Clear when the missing path is the card's only source", () => {
    const health = classifyCardHealth(input({ localAudioPath: "/lib/a.mp3", audioState: "missing" }));
    expect(health.clear).toEqual([]);
    expect(health.redownload).toEqual([]);
    expect(health.noPlayableSource).toBe(true);
  });

  it("offers Clear when another source remains, even a local one", () => {
    const health = classifyCardHealth(input({
      localVideoPath: "/lib/a.webm", videoState: "ok", localAudioPath: "/lib/a.mp3", audioState: "missing",
    }));
    expect(health.clear).toEqual(["audio"]);
    expect(health.noPlayableSource).toBe(false);
  });

  it("reports an outside-library file without Clear or Re-download", () => {
    const health = classifyCardHealth(input({
      localVideoPath: "/elsewhere/a.webm", videoState: "outsideLibrary", animethemesVideoUrl: AMQ_VIDEO,
    }));
    expect(health.localIssues).toEqual([{ kind: "video", problem: "outsideLibrary", path: "/elsewhere/a.webm" }]);
    expect(health.clear).toEqual([]);
    expect(health.redownload).toEqual([]);
    expect(needsAttention(health)).toBe(true);
  });

  it("offers Re-source for blocked animethemes.moe URLs unless the setting is animethemes-only", () => {
    const anisongdb = classifyCardHealth(input({ animethemesVideoUrl: AT_VIDEO, animethemesAudioUrl: AT_AUDIO }));
    expect(anisongdb.noPlayableSource).toBe(true);
    expect(anisongdb.resource).toBe(true);

    const noSource = classifyCardHealth(input({
      localVideoPath: "/lib/a.webm", videoState: "missing", clipSource: "animethemes", animethemesVideoUrl: AMQ_VIDEO,
    }));
    expect(noSource.noPlayableSource).toBe(true);
    expect(noSource.resource).toBe(false);
  });

  it("offers Re-source for a missing local file backed by an animethemes.moe URL", () => {
    const health = classifyCardHealth(input({
      localVideoPath: "/lib/a.webm", videoState: "missing", animethemesVideoUrl: AT_VIDEO,
    }));
    expect(health.resource).toBe(true);
  });
});
