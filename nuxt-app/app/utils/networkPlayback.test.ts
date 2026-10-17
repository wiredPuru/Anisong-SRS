import { describe, expect, it } from "vitest";
import { isOfflineUncachedFailure, networkMediaKind } from "./networkPlayback.ts";

const options = { offlineMode: true, audioOnly: false, audioFallback: false, localVideo: false, localAudio: true, hasVideo: true, hasAudio: true };
describe("network playback priority", () => {
  it("prefers readable local audio over remote-only video offline", () => {
    expect(networkMediaKind(options)).toBe("audio");
    expect(networkMediaKind({ ...options, offlineMode: null })).toBe("audio");
    expect(networkMediaKind({ ...options, offlineMode: false })).toBe("video");
  });
  it("honors audio-only and manual fallback when local audio is usable", () => {
    expect(networkMediaKind({ ...options, localVideo: true, audioOnly: true })).toBe("audio");
    expect(networkMediaKind({ ...options, localVideo: true, audioFallback: true })).toBe("audio");
    expect(networkMediaKind({ ...options, localVideo: true })).toBe("video");
  });
  it("does not assume a missing stored audio file is available", () => {
    expect(networkMediaKind({ ...options, localAudio: false })).toBe("video");
  });
  it("allows same-origin cache playback when no local files exist", () => {
    expect(networkMediaKind({ ...options, localAudio: false, hasVideo: false })).toBe("audio");
  });
});

describe("isOfflineUncachedFailure", () => {
  const stream = "/api/media/stream?url=https%3A%2F%2Fnaedist.animemusicquiz.com%2Fa.webm";

  it("is true for a failed stream URL while Offline mode is on", () => {
    expect(isOfflineUncachedFailure(true, stream)).toBe(true);
    expect(isOfflineUncachedFailure(true, `http://localhost:3000${stream}`)).toBe(true);
  });

  it("is false online, with an unknown mode, or without a source", () => {
    expect(isOfflineUncachedFailure(false, stream)).toBe(false);
    expect(isOfflineUncachedFailure(null, stream)).toBe(false);
    expect(isOfflineUncachedFailure(true, null)).toBe(false);
    expect(isOfflineUncachedFailure(true, "")).toBe(false);
  });

  it("is false for a local file that failed to load", () => {
    expect(isOfflineUncachedFailure(true, "/api/media?path=%2Flib%2Fa.webm")).toBe(false);
  });
});
