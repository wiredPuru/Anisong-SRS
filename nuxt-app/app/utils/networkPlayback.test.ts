import { describe, expect, it } from "vitest";
import { networkMediaKind } from "./networkPlayback.ts";

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
