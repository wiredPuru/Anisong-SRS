import { describe, expect, it } from "vitest";
import { backgroundClips, kanjiKeyAction, nextClipIndex, pickSourceClip, storyView } from "./kanjiStudy.ts";

describe("kanjiKeyAction", () => {
  it("reveals with Space or Enter before the answer shows", () => {
    expect(kanjiKeyAction(" ", false)).toBe("reveal");
    expect(kanjiKeyAction("Enter", false)).toBe("reveal");
  });

  it("does not grade before the reveal", () => {
    expect(kanjiKeyAction("ArrowRight", false)).toBeNull();
    expect(kanjiKeyAction("ArrowLeft", false)).toBeNull();
  });

  it("grades with the arrows after the reveal and no longer reveals", () => {
    expect(kanjiKeyAction("ArrowRight", true)).toBe("pass");
    expect(kanjiKeyAction("ArrowLeft", true)).toBe("fail");
    expect(kanjiKeyAction(" ", true)).toBeNull();
    expect(kanjiKeyAction("Enter", true)).toBeNull();
  });

  it("ignores other keys and any held modifier", () => {
    expect(kanjiKeyAction("a", false)).toBeNull();
    expect(kanjiKeyAction(" ", false, { ctrl: true })).toBeNull();
    expect(kanjiKeyAction("ArrowRight", true, { meta: true })).toBeNull();
    expect(kanjiKeyAction("ArrowLeft", true, { alt: true })).toBeNull();
  });
});

describe("nextClipIndex", () => {
  it("steps forward and wraps at the end", () => {
    expect(nextClipIndex(0, 3)).toBe(1);
    expect(nextClipIndex(2, 3)).toBe(0);
  });

  it("stays at zero for a single clip or none", () => {
    expect(nextClipIndex(0, 1)).toBe(0);
    expect(nextClipIndex(0, 0)).toBe(0);
  });
});

describe("backgroundClips", () => {
  const blank = { localVideoPath: null, localAudioPath: null, animethemesVideoUrl: null, animethemesAudioUrl: null };

  it("keeps only playable cards, capped at the limit", () => {
    const cards = [
      { id: 1, ...blank },
      { id: 2, ...blank, localAudioPath: "a.mp3" },
      { id: 3, ...blank, localVideoPath: "b.webm" },
      { id: 4, ...blank, localVideoPath: "c.webm" },
    ];
    expect(backgroundClips(cards, "anisongdb", 2).map((card) => card.id)).toEqual([2, 3]);
    expect(backgroundClips(cards, "anisongdb", 10).map((card) => card.id)).toEqual([2, 3, 4]);
  });

  it("drops a remote clip the Clip source setting excludes", () => {
    const remote = { id: 1, ...blank, animethemesVideoUrl: "https://v.animethemes.moe/x.webm" };
    expect(backgroundClips([remote], "anisongdb", 5)).toEqual([]);
    expect(backgroundClips([remote], "both", 5)).toHaveLength(1);
  });
});

describe("pickSourceClip", () => {
  const remote = { localVideoPath: null, localAudioPath: null, animethemesVideoUrl: "https://v.animethemes.moe/a.webm", animethemesAudioUrl: null };
  const local = { ...remote, localVideoPath: "/library/a.webm", animethemesVideoUrl: null };

  it("returns a playable source card", () => {
    expect(pickSourceClip(local, "anisongdb")).toBe(local);
  });

  it("returns null with no source card", () => {
    expect(pickSourceClip(null, "both")).toBeNull();
  });

  it("returns null when Clip source blocks the only remote URL", () => {
    expect(pickSourceClip(remote, "anisongdb")).toBeNull();
    expect(pickSourceClip(remote, "animethemes")).toBe(remote);
  });
});

describe("storyView", () => {
  const koohii = { text: "Flowers change.", author: "Copycatken", url: "https://example.test/花" };

  it("prefers the user's own story over the default", () => {
    expect(storyView("my story", koohii)).toEqual({ kind: "personal", text: "my story" });
  });

  it("falls back to the default with its author and source", () => {
    expect(storyView(null, koohii)).toEqual({ kind: "default", ...koohii });
  });

  it("treats a blank own story as none, so the default shows", () => {
    expect(storyView("  ", koohii).kind).toBe("default");
  });

  it("is none with no default, or a default with no text", () => {
    expect(storyView(null, null)).toEqual({ kind: "none" });
    expect(storyView(null, { ...koohii, text: null })).toEqual({ kind: "none" });
  });
});
