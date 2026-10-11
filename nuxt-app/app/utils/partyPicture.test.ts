import { describe, expect, it } from "vitest";
import { DEFAULT_HIDING_PICTURE, togglePicture } from "./partyPicture";

describe("togglePicture", () => {
  it("hides the video behind the remembered picture", () => {
    expect(togglePicture("video", DEFAULT_HIDING_PICTURE)).toEqual({ picture: "bubbles", lastHiding: "bubbles" });
    expect(togglePicture("video", "music")).toEqual({ picture: "music", lastHiding: "music" });
  });

  it("goes back to the video from a hiding picture and remembers it", () => {
    expect(togglePicture("bubbles", "music")).toEqual({ picture: "video", lastHiding: "bubbles" });
    expect(togglePicture("music", "bubbles")).toEqual({ picture: "video", lastHiding: "music" });
  });

  it("returns to the picture it came from on the next press", () => {
    const off = togglePicture("music", DEFAULT_HIDING_PICTURE);
    expect(togglePicture(off.picture, off.lastHiding).picture).toBe("music");
  });

  it("keeps the remembered picture when the current one is not a hiding picture", () => {
    expect(togglePicture("blackout", "music")).toEqual({ picture: "video", lastHiding: "music" });
  });
});
