import { describe, expect, it } from "vitest";
import { isCardPlayableOffline, type PlayableChecks, type PlayableSources } from "./offlinePlayable.ts";

const none: PlayableSources = { localVideoPath: null, localAudioPath: null, animethemesVideoUrl: null, animethemesAudioUrl: null };

function checks(overrides: Partial<PlayableChecks> = {}): PlayableChecks {
  return { localFileUsable: () => false, clipAllowed: () => true, clipCached: () => false, ...overrides };
}

describe("isCardPlayableOffline", () => {
  it("is false for a card with no source", () => {
    expect(isCardPlayableOffline(none, checks())).toBe(false);
  });

  it("is true for a usable local file of either kind", () => {
    const usable = checks({ localFileUsable: (path) => path === "/lib/a.webm" });
    expect(isCardPlayableOffline({ ...none, localVideoPath: "/lib/a.webm" }, usable)).toBe(true);
    expect(isCardPlayableOffline({ ...none, localAudioPath: "/lib/a.webm" }, usable)).toBe(true);
  });

  it("is false when the local file is missing or outside the library", () => {
    expect(isCardPlayableOffline({ ...none, localVideoPath: "/lib/gone.webm" }, checks())).toBe(false);
  });

  it("is true for a remote clip only when its complete copy is cached", () => {
    const sources = { ...none, animethemesVideoUrl: "https://naedist.animemusicquiz.com/a.webm" };
    expect(isCardPlayableOffline(sources, checks())).toBe(false);
    expect(isCardPlayableOffline(sources, checks({ clipCached: () => true }))).toBe(true);
  });

  it("ignores a cached clip the Clip source setting blocks", () => {
    const sources = { ...none, animethemesAudioUrl: "https://a.animethemes.moe/a.ogg" };
    expect(isCardPlayableOffline(sources, checks({ clipCached: () => true, clipAllowed: () => false }))).toBe(false);
  });

  it("falls through to the second source when the first is unusable", () => {
    const sources = { ...none, localVideoPath: "/lib/gone.webm", animethemesAudioUrl: "https://a.animethemes.moe/a.ogg" };
    expect(isCardPlayableOffline(sources, checks({ clipCached: (url) => url.endsWith(".ogg") }))).toBe(true);
  });
});
