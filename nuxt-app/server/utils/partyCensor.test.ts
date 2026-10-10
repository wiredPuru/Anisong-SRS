import { describe, expect, it } from "vitest";
import { CENSOR_MAX_BOXES, parsePartyCensor } from "./partyCensor.ts";

describe("parsePartyCensor", () => {
  it("passes null through as no censor", () => {
    expect(parsePartyCensor(null)).toBeNull();
  });

  it("keeps a valid censor", () => {
    expect(parsePartyCensor({ boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }], style: "blur", muted: false })).toEqual({
      boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }],
      style: "blur",
      muted: false,
    });
  });

  it("pulls a box back inside the picture and widens a sliver", () => {
    const parsed = parsePartyCensor({ boxes: [{ x: 0.9, y: -0.5, w: 0.3, h: 0 }], style: "black", muted: false });
    expect(parsed).toEqual({ boxes: [{ x: 0.7, y: 0, w: 0.3, h: 0.02 }], style: "black", muted: false });
  });

  it("treats no boxes and no mute as no censor, but keeps a mute-only one", () => {
    expect(parsePartyCensor({ boxes: [], style: "black", muted: false })).toBeNull();
    expect(parsePartyCensor({ boxes: [], style: "black", muted: true })).toEqual({ boxes: [], style: "black", muted: true });
  });

  it("rejects bad input", () => {
    expect(parsePartyCensor("x")).toHaveProperty("error");
    expect(parsePartyCensor({ boxes: [], style: "pink", muted: true })).toHaveProperty("error");
    expect(parsePartyCensor({ boxes: [{ x: "a", y: 0, w: 1, h: 1 }], style: "blur", muted: false })).toHaveProperty("error");
    const tooMany = Array.from({ length: CENSOR_MAX_BOXES + 1 }, () => ({ x: 0, y: 0, w: 0.1, h: 0.1 }));
    expect(parsePartyCensor({ boxes: tooMany, style: "blur", muted: false })).toHaveProperty("error");
  });
});
