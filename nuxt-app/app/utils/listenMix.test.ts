import { describe, expect, it } from "vitest";
import {
  listenMixGains,
  parseListenMixCurve,
  parseListenMixLength,
  parseListenMixPreference,
  secondsUntilHandoff,
  planListenMix,
  remainingListenSeconds,
  type ListenMixSegment,
} from "./listenMix";

const fullSong: ListenMixSegment = { duration: 90, startOffset: 0, playLength: 0 };

function overlap(outgoing: ListenMixSegment | null, incoming: ListenMixSegment | null = fullSong): number {
  return planListenMix({ enabled: true, autoplay: true, outgoing, incoming });
}

describe("Mix preference", () => {
  it("enables only the explicit saved on value", () => {
    expect(parseListenMixPreference("1")).toBe(true);
    for (const stored of [null, "0", "", " ", " 1 ", "true", "false", "5", "null", "{}"]) {
      expect(parseListenMixPreference(stored)).toBe(false);
    }
  });
});

describe("Mix overlap planning", () => {
  it("uses five seconds for two long full songs", () => {
    expect(overlap(fullSong)).toBe(5);
  });

  it("requires both Mix and Autoplay", () => {
    for (const [enabled, autoplay] of [[false, false], [false, true], [true, false]] as const) {
      expect(planListenMix({ enabled, autoplay, outgoing: fullSong, incoming: fullSong })).toBe(0);
    }
  });

  it("does not mix an empty queue or the final song", () => {
    expect(overlap(null)).toBe(0);
    expect(overlap(fullSong, null)).toBe(0);
  });

  it("respects a play-length endpoint after a random start", () => {
    const timed = { duration: 150, startOffset: 60, playLength: 30 };
    const fade = overlap(timed);
    const remaining = remainingListenSeconds({ duration: 150, currentTime: 85, playLengthRemaining: 5 });
    expect(fade).toBe(5);
    expect(remaining).toBe(fade);
    expect(overlap({ ...timed, playLength: 6 })).toBe(3);
    expect(overlap(fullSong, { ...timed, playLength: 4 })).toBe(2);
  });

  it("shortens the overlap to half of either playable segment", () => {
    const short = { duration: 90, startOffset: 84, playLength: 30 };
    expect(overlap(short)).toBe(3);
    expect(overlap(fullSong, { duration: 4, startOffset: 0, playLength: 0 })).toBe(2);
    expect(overlap({ duration: 4, startOffset: 1, playLength: 0 }, short)).toBe(1.5);
  });

  it("accepts a one-second overlap but falls back below it", () => {
    expect(overlap({ duration: 2, startOffset: 0, playLength: 0 })).toBe(1);
    expect(overlap({ duration: 1.99, startOffset: 0, playLength: 0 })).toBe(0);
  });

  it("falls back for unknown or invalid duration on either side, even with a play length", () => {
    for (const duration of [null, 0, -1, NaN, Infinity, -Infinity]) {
      const unknown = { ...fullSong, duration, playLength: 30 };
      expect(overlap(unknown)).toBe(0);
      expect(overlap(fullSong, unknown)).toBe(0);
    }
  });

  it("rejects invalid offsets and lengths on either side", () => {
    const invalid = [
      ...[-1, 90, 91, NaN, Infinity, -Infinity].map((startOffset) => ({ ...fullSong, startOffset })),
      ...[-1, NaN, Infinity, -Infinity].map((playLength) => ({ ...fullSong, playLength })),
    ];
    for (const segment of invalid) {
      expect(overlap(segment)).toBe(0);
      expect(overlap(fullSong, segment)).toBe(0);
    }
  });
});

describe("remaining Listen time", () => {
  it("uses the earlier of clip end and the unchanged playing-time budget", () => {
    expect(remainingListenSeconds({ duration: 90, currentTime: 20, playLengthRemaining: 8 })).toBe(8);
    expect(remainingListenSeconds({ duration: 90, currentTime: 87, playLengthRemaining: 8 })).toBe(3);
    expect(remainingListenSeconds({ duration: 90, currentTime: 10, playLengthRemaining: 8 })).toBe(8);
  });

  it("uses the clip endpoint for a full song and clamps ended clips to zero", () => {
    expect(remainingListenSeconds({ duration: 90, currentTime: 85, playLengthRemaining: null })).toBe(5);
    expect(remainingListenSeconds({ duration: 90, currentTime: 91, playLengthRemaining: null })).toBe(0);
    expect(remainingListenSeconds({ duration: 90, currentTime: 5, playLengthRemaining: 0 })).toBe(0);
  });

  it("keeps a known timer deadline when clip duration is unresolved", () => {
    for (const duration of [null, 0, NaN, Infinity]) {
      expect(remainingListenSeconds({ duration, currentTime: 0, playLengthRemaining: 5 })).toBe(5);
      expect(remainingListenSeconds({ duration, currentTime: 0, playLengthRemaining: null })).toBeNull();
    }
  });

  it("does not invent a deadline from malformed position or budget values", () => {
    for (const currentTime of [-1, NaN, Infinity, -Infinity]) {
      expect(remainingListenSeconds({ duration: 90, currentTime, playLengthRemaining: 5 })).toBeNull();
    }
    for (const playLengthRemaining of [-1, NaN, Infinity, -Infinity]) {
      expect(remainingListenSeconds({ duration: 90, currentTime: 0, playLengthRemaining })).toBeNull();
    }
  });
});

describe("Mix gain envelope", () => {
  it("fades linearly from outgoing to incoming", () => {
    expect(listenMixGains(0)).toEqual({ outgoing: 1, incoming: 0 });
    expect(listenMixGains(0.25)).toEqual({ outgoing: 0.75, incoming: 0.25 });
    expect(listenMixGains(0.5)).toEqual({ outgoing: 0.5, incoming: 0.5 });
    expect(listenMixGains(1)).toEqual({ outgoing: 0, incoming: 1 });
  });

  it("keeps both gains bounded and complementary, including bad progress", () => {
    for (const progress of [-Infinity, -10, 0, 0.001, 0.17, 0.9, 1, 10, Infinity, NaN]) {
      const gains = listenMixGains(progress);
      expect(gains.incoming).toBeGreaterThanOrEqual(0);
      expect(gains.incoming).toBeLessThanOrEqual(1);
      expect(gains.outgoing).toBeGreaterThanOrEqual(0);
      expect(gains.outgoing).toBeLessThanOrEqual(1);
      expect(gains.incoming + gains.outgoing).toBeCloseTo(1);
    }
    expect(listenMixGains(NaN)).toEqual({ outgoing: 1, incoming: 0 });
  });
});

describe("Mix fade length", () => {
  it("accepts exactly the offered lengths and defaults otherwise", () => {
    for (const length of [2, 5, 8, 12]) expect(parseListenMixLength(String(length))).toBe(length);
    for (const stored of [null, "", "0", "3", "7", "13", " 8", "8 ", "8.0", "abc", "-2"]) {
      expect(parseListenMixLength(stored)).toBe(5);
    }
  });

  it("uses the chosen length for long songs", () => {
    const plan = (targetSeconds: number) => planListenMix({ enabled: true, autoplay: true, targetSeconds, outgoing: fullSong, incoming: fullSong });
    expect(plan(2)).toBe(2);
    expect(plan(12)).toBe(12);
  });

  it("caps a long fade by half of the shorter song", () => {
    const short: ListenMixSegment = { duration: 20, startOffset: 0, playLength: 0 };
    const plan = (outgoing: ListenMixSegment, incoming: ListenMixSegment) =>
      planListenMix({ enabled: true, autoplay: true, targetSeconds: 12, outgoing, incoming });
    expect(plan(short, fullSong)).toBe(10);
    expect(plan(fullSong, short)).toBe(10);
    expect(plan(fullSong, { duration: 90, startOffset: 0, playLength: 6 })).toBe(3);
  });

  it("still falls back to ordinary advancement under one second", () => {
    const tiny: ListenMixSegment = { duration: 1.5, startOffset: 0, playLength: 0 };
    expect(planListenMix({ enabled: true, autoplay: true, targetSeconds: 12, outgoing: tiny, incoming: fullSong })).toBe(0);
  });

  it("counts a Next in label down to the handoff, never below zero", () => {
    expect(secondsUntilHandoff(30, 8)).toBe(22);
    expect(secondsUntilHandoff(3, 8)).toBe(0);
  });
});

describe("Mix fade curve preference", () => {
  it("reads Linear unless Smooth was saved exactly", () => {
    expect(parseListenMixCurve("smooth")).toBe("smooth");
    for (const stored of [null, "", "linear", "Smooth", " smooth", "equal", "1", "{}"]) {
      expect(parseListenMixCurve(stored)).toBe("linear");
    }
  });
});
