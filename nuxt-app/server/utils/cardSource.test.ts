import { describe, expect, it } from "vitest";
import { parseApplySourceBody } from "./cardSource.ts";

describe("parseApplySourceBody", () => {
  it("accepts a video-only, audio-only, or combined body", () => {
    expect(parseApplySourceBody({ cardId: 3, videoUrl: "https://naedist.animemusicquiz.com/a.webm" })).toEqual({
      cardId: 3,
      videoUrl: "https://naedist.animemusicquiz.com/a.webm",
      audioUrl: null,
    });
    expect(parseApplySourceBody({ cardId: 3, audioUrl: " https://eudist.animemusicquiz.com/a.mp3 " })).toEqual({
      cardId: 3,
      videoUrl: null,
      audioUrl: "https://eudist.animemusicquiz.com/a.mp3",
    });
  });

  it("requires a positive integer card id and at least one URL", () => {
    expect(parseApplySourceBody({ cardId: 0, videoUrl: "https://x" })).toHaveProperty("error");
    expect(parseApplySourceBody({ cardId: 1.5, videoUrl: "https://x" })).toHaveProperty("error");
    expect(parseApplySourceBody({ cardId: 1 })).toHaveProperty("error");
    expect(parseApplySourceBody({ cardId: 1, videoUrl: "  ", audioUrl: null })).toHaveProperty("error");
    expect(parseApplySourceBody(null)).toHaveProperty("error");
  });

  it("rejects non-string URLs", () => {
    expect(parseApplySourceBody({ cardId: 1, videoUrl: 5 })).toHaveProperty("error");
  });
});
