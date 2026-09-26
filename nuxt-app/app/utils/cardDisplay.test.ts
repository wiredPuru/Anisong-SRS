import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compactSourceBadges, dueLabel, isDueNow, sourceBadges } from "./cardDisplay";

const NO_SOURCES = {
  localVideoPath: null,
  localAudioPath: null,
  animethemesVideoUrl: null,
  animethemesAudioUrl: null,
};

describe("dueLabel / isDueNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (...parts: [number, number, number, number?]) =>
    ({ nextReviewAt: new Date(parts[0], parts[1], parts[2], parts[3] ?? 0).toISOString() });

  it("reads Today for a card overdue by days", () => {
    expect(dueLabel(at(2026, 8, 20))).toBe("Today");
    expect(isDueNow(at(2026, 8, 20))).toBe(true);
  });

  it("reads Today for a card due later today, which is not yet due now", () => {
    expect(dueLabel(at(2026, 8, 26, 18))).toBe("Today");
    expect(isDueNow(at(2026, 8, 26, 18))).toBe(false);
  });

  it("counts whole calendar days ahead", () => {
    expect(dueLabel(at(2026, 8, 27, 1))).toBe("in 1d");
    expect(dueLabel(at(2026, 9, 10))).toBe("in 14d");
  });

  it("reads - for an unparseable date", () => {
    expect(dueLabel({ nextReviewAt: "not a date" })).toBe("-");
    expect(isDueNow({ nextReviewAt: "not a date" })).toBe(false);
  });
});

describe("compactSourceBadges", () => {
  it("prefers local over remote for the same kind", () => {
    expect(
      compactSourceBadges({ ...NO_SOURCES, localVideoPath: "/a.webm", animethemesVideoUrl: "https://x/a.webm" }),
    ).toEqual(["VID"]);
  });

  it("stars a remote-only kind", () => {
    expect(
      compactSourceBadges({ ...NO_SOURCES, animethemesVideoUrl: "https://x/a.webm", localAudioPath: "/a.mp3" }),
    ).toEqual(["VID*", "AUD"]);
  });

  it("is empty for a card with no source", () => {
    expect(compactSourceBadges(NO_SOURCES)).toEqual([]);
  });
});

describe("sourceBadges", () => {
  it("lists every source, local before remote", () => {
    expect(
      sourceBadges({
        localVideoPath: "/a.webm",
        localAudioPath: "/a.mp3",
        animethemesVideoUrl: "https://x/a.webm",
        animethemesAudioUrl: "https://x/a.ogg",
      }),
    ).toEqual(["Local video", "Local audio", "Remote video", "Remote audio"]);
  });

  it("is empty for a card with no source", () => {
    expect(sourceBadges(NO_SOURCES)).toEqual([]);
  });
});
