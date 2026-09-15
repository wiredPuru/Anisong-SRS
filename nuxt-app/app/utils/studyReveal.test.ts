import { describe, expect, it } from "vitest";
import { canAutoReveal, transitionTypedAnswerVideo } from "./studyReveal";

describe("Study reveal eligibility", () => {
  it.each(["off", "video", "info", "both"])("suppresses %s while answering", (mode) => {
    for (const started of [false, true]) {
      for (const revealed of [false, true]) {
        expect(canAutoReveal(true, mode, started, revealed)).toBe(false);
      }
    }
  });
  it.each(["video", "info", "both"])("restores %s only after playback starts and before reveal", (mode) => {
    expect(canAutoReveal(false, mode, true, false)).toBe(true);
    expect(canAutoReveal(false, mode, false, false)).toBe(false);
    expect(canAutoReveal(false, mode, true, true)).toBe(false);
  });
  it("keeps the saved off preference off", () => {
    expect(canAutoReveal(false, "off", true, false)).toBe(false);
  });
});

describe("Typed Answers video visibility", () => {
  it("temporarily reveals video hidden by Auto Reveal and restores it", () => {
    const enabled = transitionTypedAnswerVideo(true, true, true, null);
    expect(enabled).toEqual({ hideVideo: false, hiddenBeforeTypedAnswers: true });
    expect(transitionTypedAnswerVideo(false, true, enabled.hideVideo, enabled.hiddenBeforeTypedAnswers))
      .toEqual({ hideVideo: true, hiddenBeforeTypedAnswers: null });
  });

  it("preserves a manual Hide Video choice when Auto Reveal does not target video", () => {
    expect(transitionTypedAnswerVideo(true, false, true, null))
      .toEqual({ hideVideo: true, hiddenBeforeTypedAnswers: null });
  });
});
