import { describe, expect, it } from "vitest";
import { parseAutoplayPreference, planAutoplay } from "./autoplay";

describe("planAutoplay", () => {
  it("does nothing when autoplay is off", () => {
    expect(planAutoplay({ autoplay: false, hasSource: true, canDownloadFirst: true })).toBe("none");
  });

  it("does nothing for a card with no loadable source", () => {
    expect(planAutoplay({ autoplay: true, hasSource: false, canDownloadFirst: false })).toBe("none");
  });

  it("plays straight away when the clip is local or cannot be saved", () => {
    expect(planAutoplay({ autoplay: true, hasSource: true, canDownloadFirst: false })).toBe("play");
  });

  it("downloads first when the clip is remote-only and a download folder exists", () => {
    expect(planAutoplay({ autoplay: true, hasSource: true, canDownloadFirst: true })).toBe("download-then-play");
  });
});

describe("parseAutoplayPreference", () => {
  it("defaults to on when nothing is stored", () => {
    expect(parseAutoplayPreference(null)).toBe(true);
  });

  it("is off only for an explicit 0", () => {
    expect(parseAutoplayPreference("0")).toBe(false);
    expect(parseAutoplayPreference("1")).toBe(true);
  });

  it("falls back to on for an unreadable value", () => {
    expect(parseAutoplayPreference("garbage")).toBe(true);
  });
});
