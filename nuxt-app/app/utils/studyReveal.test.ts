import { describe, expect, it } from "vitest";
import { autoRevealExpiryAction, canAutoReveal } from "./studyReveal";

describe("Study reveal eligibility", () => {
  it.each(["video", "info", "both"])("runs %s only after playback starts and before reveal", (mode) => {
    expect(canAutoReveal(mode, true, false, true)).toBe(true);
    expect(canAutoReveal(mode, false, false, true)).toBe(false);
    expect(canAutoReveal(mode, true, true, true)).toBe(false);
  });
  it("keeps the saved off preference off", () => {
    expect(canAutoReveal("off", true, false, true)).toBe(false);
  });
  it.each(["video", "info", "both"])("never runs %s on a round that cannot be answered", (mode) => {
    expect(canAutoReveal(mode, true, false, false)).toBe(false);
  });
});

describe("Auto Reveal expiry", () => {
  it("reveals outside typed mode, whatever else is going on", () => {
    for (const blocked of [false, true]) {
      for (const resultShown of [false, true]) {
        expect(autoRevealExpiryAction({ typedAnswers: false, blocked, resultShown })).toBe("reveal");
      }
    }
  });
  it("submits an open typed round", () => {
    expect(autoRevealExpiryAction({ typedAnswers: true, blocked: false, resultShown: false })).toBe("submit");
  });
  it("holds a typed round while answering is blocked", () => {
    expect(autoRevealExpiryAction({ typedAnswers: true, blocked: true, resultShown: false })).toBe("hold");
  });
  it("does nothing once the typed result is showing", () => {
    expect(autoRevealExpiryAction({ typedAnswers: true, blocked: false, resultShown: true })).toBe("none");
    expect(autoRevealExpiryAction({ typedAnswers: true, blocked: true, resultShown: true })).toBe("none");
  });
});
