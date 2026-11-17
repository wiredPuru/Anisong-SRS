import { describe, expect, it } from "vitest";
import {
  audioFirstObscure,
  audioFirstStyleLabel,
  audioFirstVeiled,
  isAnswerReveal,
  peepholeCenter,
  resolveAudioFirstStyle,
  type AudioFirstVeilState,
} from "./audioFirst";

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

describe("resolveAudioFirstStyle", () => {
  it.each(["blind", "blur", "pixelate", "peephole"] as const)("keeps the fixed %s style", (style) => {
    expect(resolveAudioFirstStyle(style, 7)).toBe(style);
  });

  it("gives Random every obscuring style across seeds, and never Blind", () => {
    const seen = new Set(Array.from({ length: 60 }, (_, seed) => resolveAudioFirstStyle("random", seed)));
    expect([...seen].sort()).toEqual(["blur", "peephole", "pixelate"]);
  });

  it("is the same for the same seed", () => {
    expect(resolveAudioFirstStyle("random", 4242)).toBe(resolveAudioFirstStyle("random", 4242));
  });
});

describe("audioFirstObscure", () => {
  it("is null while the picture is not hidden", () => {
    expect(audioFirstObscure({ hidden: false, forcedBlind: false, treatment: "blur" })).toBeNull();
  });

  it("leaves Blind to the veil", () => {
    expect(audioFirstObscure({ hidden: true, forcedBlind: false, treatment: "blind" })).toBeNull();
  });

  it("gives way when Hide Video or Auto Reveal already hides the picture", () => {
    expect(audioFirstObscure({ hidden: true, forcedBlind: true, treatment: "pixelate" })).toBeNull();
  });

  it.each(["blur", "pixelate", "peephole"] as const)("applies %s while hidden", (treatment) => {
    expect(audioFirstObscure({ hidden: true, forcedBlind: false, treatment })).toBe(treatment);
  });
});

describe("audioFirstStyleLabel", () => {
  it("names every style but Blind", () => {
    expect(audioFirstStyleLabel("blind")).toBeNull();
    expect(audioFirstStyleLabel("random")).toBe("Random");
    expect(audioFirstStyleLabel("peephole")).toBe("Peephole");
  });
});

describe("peepholeCenter", () => {
  it("stays inside the frame", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (let seconds = 0; seconds < 120; seconds += 0.7) {
        const { x, y } = peepholeCenter(seconds, seed);
        expect(x).toBeGreaterThanOrEqual(20);
        expect(x).toBeLessThanOrEqual(80);
        expect(y).toBeGreaterThanOrEqual(26);
        expect(y).toBeLessThanOrEqual(74);
      }
    }
  });

  it("moves over time", () => {
    expect(peepholeCenter(0, 3)).not.toEqual(peepholeCenter(2, 3));
  });
});
