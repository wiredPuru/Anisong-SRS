import { describe, expect, it } from "vitest";
import { animethemesVideoSlug, type AnimeThemesVideoSlugParts } from "./animethemesLinks.ts";

const base: AnimeThemesVideoSlugParts = { type: "OP", sequence: 1, groupSlug: null, entryVersion: 1, videoTags: null };

describe("animethemesVideoSlug", () => {
  it.each<[Partial<AnimeThemesVideoSlugParts>, string]>([
    [{}, "OP1"],
    [{ type: "ED", sequence: 2 }, "ED2"],
    [{ entryVersion: 2 }, "OP1v2"],
    [{ videoTags: "NCBD1080" }, "OP1-NCBD1080"],
    [{ entryVersion: 3, videoTags: "NC" }, "OP1v3-NC"],
    [{ groupSlug: "dub" }, "OP1-dub"],
    [{ entryVersion: 2, groupSlug: "dub", videoTags: "BD1080" }, "OP1v2-dub-BD1080"],
  ])("builds %o as %s", (overrides, expected) => {
    expect(animethemesVideoSlug({ ...base, ...overrides })).toBe(expected);
  });

  it("treats a missing sequence as 1, like AnimeThemes does", () => {
    expect(animethemesVideoSlug({ ...base, sequence: null })).toBe("OP1");
    expect(animethemesVideoSlug({ ...base, sequence: 0 })).toBe("OP1");
  });

  it("never writes v1, and a missing version adds nothing", () => {
    expect(animethemesVideoSlug({ ...base, entryVersion: 1 })).toBe("OP1");
    expect(animethemesVideoSlug({ ...base, entryVersion: null })).toBe("OP1");
  });

  it("adds nothing for empty tags or group", () => {
    expect(animethemesVideoSlug({ ...base, videoTags: "", groupSlug: "" })).toBe("OP1");
  });

  it.each([null, "", "  "])("returns null without a type (%o)", (type) => {
    expect(animethemesVideoSlug({ ...base, type })).toBeNull();
  });
});
