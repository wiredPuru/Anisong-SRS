import { describe, expect, it } from "vitest";
import { matchAlternateClip, swapTarget } from "./partySourceSwap.ts";

const THEMES = [
  { songTitle: "Other Song", videoUrl: "https://v.animethemes.moe/Show-OP2.webm", audioUrl: null },
  { songTitle: "Kaikai Kitan", videoUrl: "https://v.animethemes.moe/Show-OP1.webm", audioUrl: "https://a.animethemes.moe/Show-OP1.ogg" },
];

describe("matchAlternateClip", () => {
  it("matches on the song title, ignoring case and punctuation, keeping the kind", () => {
    expect(matchAlternateClip(THEMES, "KAIKAI kitan!", "video", false)).toEqual({
      kind: "video",
      source: { type: "remote", url: "https://v.animethemes.moe/Show-OP1.webm" },
    });
    expect(matchAlternateClip(THEMES, "Kaikai Kitan", "audio", false)?.source).toEqual({ type: "remote", url: "https://a.animethemes.moe/Show-OP1.ogg" });
  });

  it("falls back to the other kind, and never to video when audio only", () => {
    const videoOnly = [{ songTitle: "Song", videoUrl: "https://v.animethemes.moe/x.webm", audioUrl: null }];
    expect(matchAlternateClip(videoOnly, "Song", "audio", false)?.kind).toBe("video");
    expect(matchAlternateClip(videoOnly, "Song", "audio", true)).toBeNull();
  });

  it("finds nothing for a different or empty title", () => {
    expect(matchAlternateClip(THEMES, "Unknown", "video", false)).toBeNull();
    expect(matchAlternateClip(THEMES, "", "video", false)).toBeNull();
  });
});

describe("swapTarget", () => {
  it("goes to the provider the clip is not on", () => {
    expect(swapTarget({ kind: "video", source: { type: "remote", url: "https://v.animethemes.moe/a.webm" } })).toBe("anisongdb");
    expect(swapTarget({ kind: "video", source: { type: "remote", url: "https://naedist.animemusicquiz.com/a.webm" } })).toBe("animethemes");
    expect(swapTarget({ kind: "audio", source: { type: "local", path: "/x.mp3" } })).toBe("animethemes");
  });
});
