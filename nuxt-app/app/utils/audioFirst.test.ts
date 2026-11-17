import { describe, expect, it } from "vitest";
import { audioFirstVeiled, isAnswerReveal, type AudioFirstVeilState } from "./audioFirst";

const base: AudioFirstVeilState = { audioFirst: true, answerRevealed: false, shownByUser: false, revealedByTimer: false };

describe("audioFirstVeiled", () => {
  it("never veils an unmarked card", () => {
    expect(audioFirstVeiled({ ...base, audioFirst: false })).toBe(false);
  });

  it("veils until something lifts it, including when nothing hid the answer", () => {
    expect(audioFirstVeiled(base)).toBe(true);
  });

  it("lifts once a hidden answer is revealed", () => {
    expect(audioFirstVeiled({ ...base, answerRevealed: true })).toBe(false);
  });

  it("lifts when the user shows the picture", () => {
    expect(audioFirstVeiled({ ...base, shownByUser: true })).toBe(false);
  });

  it("lifts when Auto Reveal fires", () => {
    expect(audioFirstVeiled({ ...base, revealedByTimer: true })).toBe(false);
  });
});

describe("isAnswerReveal", () => {
  it("is true only going from hidden to shown", () => {
    expect(isAnswerReveal(false, true)).toBe(true);
    expect(isAnswerReveal(true, false)).toBe(false);
    expect(isAnswerReveal(false, false)).toBe(false);
    expect(isAnswerReveal(true, true)).toBe(false);
  });

  it("is false on the first observation", () => {
    expect(isAnswerReveal(false, undefined)).toBe(false);
  });
});
