import { describe, expect, it } from "vitest";
import { isSavedImage, networkImageSrc } from "./networkImage.ts";
import { parseLastPlayed } from "./lastPlayed.ts";

describe("network image policy", () => {
  it.each([true, null] as const)("blocks remote art for mode %s", (mode) => {
    expect(networkImageSrc("https://s4.anilist.co/cover.jpg", mode)).toBeUndefined();
    expect(networkImageSrc("//s4.anilist.co/cover.jpg", mode)).toBeUndefined();
    expect(networkImageSrc("/\\s4.anilist.co/cover.jpg", mode)).toBeUndefined();
    expect(networkImageSrc("/\n/s4.anilist.co/cover.jpg", mode)).toBeUndefined();
    expect(networkImageSrc("/api/lookup/anilist-list?username=user", mode)).toBeUndefined();
  });
  it("preserves online covers and local assets in every mode", () => {
    expect(networkImageSrc("https://s4.anilist.co/cover.jpg", false)).toBe("https://s4.anilist.co/cover.jpg");
    for (const mode of [null, true, false]) {
      expect(networkImageSrc("/api/anime/cover?id=1&v=saved.png", mode)).toBe(`/api/anime/cover?id=1&v=saved.png${mode === false ? "" : "&localOnly=1"}`);
      expect(networkImageSrc("data:image/jpeg;base64,frame", mode)).toBe("data:image/jpeg;base64,frame");
    }
  });
  it.each(["http://remote.test/a.jpg", "javascript:alert(1)", "data:image/svg+xml,x", "broken", null])("rejects unsafe or absent input %s", (value) => {
    expect(networkImageSrc(value, false)).toBeUndefined();
  });
  it("validates saved cover history and preserves old remote history without rendering it offline", () => {
    const record = { cardId: 1, songTitle: "Song", animeTitle: "Anime", image: "/api/anime/cover?id=1&v=saved.png", tint: null };
    expect(parseLastPlayed(JSON.stringify(record))).toEqual(record);
    const remote = { ...record, image: "https://s4.anilist.co/cover.jpg" };
    expect(parseLastPlayed(JSON.stringify(remote))).toEqual(remote);
    expect(networkImageSrc(remote.image, true)).toBeUndefined();
    expect(isSavedImage("/api/anime/cover?id=-1")).toBe(false);
    expect(isSavedImage("/api/media/stream?url=https://remote.test")).toBe(false);
  });
});
