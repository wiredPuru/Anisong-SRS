import { describe, expect, it } from "vitest";
import { DEFAULT_PREVIEW_LEAD, parsePreviewLead, previewNeedsSeek, previewTarget } from "./partyPreview";

describe("previewTarget", () => {
  const position = { currentTime: 10, duration: 90, playing: true };

  it("runs the lead ahead of the display, counting time since the report", () => {
    expect(previewTarget(position, 1000, 1600, 2)).toBeCloseTo(12.6);
  });

  it("holds still while the display is paused", () => {
    expect(previewTarget({ ...position, playing: false }, 1000, 9000, 2)).toBe(12);
  });

  it("stops just short of the end", () => {
    expect(previewTarget({ ...position, currentTime: 89 }, 0, 0, 3)).toBeCloseTo(89.95);
    expect(previewTarget({ ...position, duration: null, currentTime: 89 }, 0, 0, 3)).toBe(92);
  });
});

describe("previewNeedsSeek", () => {
  it("seeks only past the drift allowance", () => {
    expect(previewNeedsSeek(12, 12.3)).toBe(false);
    expect(previewNeedsSeek(12, 12.8)).toBe(true);
    expect(previewNeedsSeek(13, 12)).toBe(true);
  });
});

describe("parsePreviewLead", () => {
  it("accepts the offered leads and falls back otherwise", () => {
    expect(parsePreviewLead("3")).toBe(3);
    expect(parsePreviewLead("4")).toBe(DEFAULT_PREVIEW_LEAD);
    expect(parsePreviewLead(null)).toBe(DEFAULT_PREVIEW_LEAD);
  });
});
