import { describe, expect, it } from "vitest";
import { isPlayableCard, positionLabel, stepIndex } from "./listenQueue";

const none = { localVideoPath: null, localAudioPath: null, animethemesVideoUrl: null, animethemesAudioUrl: null };
const AMQ = "https://naedist.animemusicquiz.com/a.webm";
const THEMES = "https://v.animethemes.moe/b.webm";

describe("isPlayableCard", () => {
  it("counts a local file whatever the Clip source is", () => {
    expect(isPlayableCard({ ...none, localVideoPath: "/m/a.webm" }, "anisongdb")).toBe(true);
    expect(isPlayableCard({ ...none, localAudioPath: "/m/a.mp3" }, "animethemes")).toBe(true);
  });

  it("follows the Clip source for remote URLs", () => {
    const amq = { ...none, animethemesVideoUrl: AMQ };
    const themes = { ...none, animethemesAudioUrl: THEMES };
    expect(isPlayableCard(amq, "anisongdb")).toBe(true);
    expect(isPlayableCard(amq, "animethemes")).toBe(false);
    expect(isPlayableCard(themes, "anisongdb")).toBe(false);
    expect(isPlayableCard(themes, "animethemes")).toBe(true);
    expect(isPlayableCard(amq, "both")).toBe(true);
    expect(isPlayableCard(themes, "both")).toBe(true);
  });

  it("rejects a card with no source", () => {
    expect(isPlayableCard(none, "both")).toBe(false);
  });
});

describe("stepIndex", () => {
  it("moves one song at a time", () => {
    expect(stepIndex(0, 3, "next")).toBe(1);
    expect(stepIndex(2, 3, "previous")).toBe(1);
  });

  it("finishes past the last song", () => {
    expect(stepIndex(2, 3, "next")).toBe("finished");
    expect(stepIndex(0, 1, "next")).toBe("finished");
  });

  it("stays on the first song going back", () => {
    expect(stepIndex(0, 3, "previous")).toBe(0);
  });

  it("handles an empty playlist", () => {
    expect(stepIndex(0, 0, "next")).toBe(0);
    expect(stepIndex(0, 0, "previous")).toBe(0);
  });
});

describe("positionLabel", () => {
  it("counts from one", () => {
    expect(positionLabel(0, 40)).toBe("1 / 40");
    expect(positionLabel(39, 40)).toBe("40 / 40");
  });

  it("never reads past the total", () => {
    expect(positionLabel(40, 40)).toBe("40 / 40");
  });
});
