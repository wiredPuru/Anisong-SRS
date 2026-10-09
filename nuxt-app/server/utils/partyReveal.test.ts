import { describe, expect, it } from "vitest";
import { ALL_REVEAL_FIELDS, initialPartyState, maskAnswer, shouldRevealEarly, type PartyAnswer, type PartyGameState } from "./partyGame.ts";

const answer: PartyAnswer = {
  animeTitleEnglish: "Frieren",
  animeTitleRomaji: "Sousou no Frieren",
  animeTitleNative: "葬送のフリーレン",
  songTitle: "Yuusha",
  artistName: "YOASOBI",
  themeSlot: "OP1",
  coverImageUrl: "https://example.test/c.jpg",
};

describe("maskAnswer", () => {
  it("passes everything through when all fields are on", () => {
    expect(maskAnswer(answer, ALL_REVEAL_FIELDS)).toEqual(answer);
  });

  it("blanks only the hidden parts, and the cover goes with the anime", () => {
    const masked = maskAnswer(answer, { anime: false, artist: true, song: false, slot: true });
    expect(masked.animeTitleEnglish).toBe("");
    expect(masked.animeTitleNative).toBe("");
    expect(masked.coverImageUrl).toBeNull();
    expect(masked.songTitle).toBe("");
    expect(masked.artistName).toBe("YOASOBI");
    expect(masked.themeSlot).toBe("OP1");
  });
});

describe("shouldRevealEarly", () => {
  const base = (over: Partial<PartyGameState>, currentTime: number, duration: number | null = 90): PartyGameState => ({
    ...initialPartyState(),
    phase: "guessing",
    position: { token: "t", currentTime, duration, playing: true, blocked: false, elapsed: currentTime },
    ...over,
  });

  it("fires once 5 seconds or less remain", () => {
    expect(shouldRevealEarly(base({}, 84))).toBe(false);
    expect(shouldRevealEarly(base({}, 85))).toBe(true);
  });

  it("holds when auto-advance is off, a lightning round runs, or someone is buzzing", () => {
    expect(shouldRevealEarly(base({ autoAdvance: false }, 89))).toBe(false);
    expect(shouldRevealEarly(base({ lightning: { mode: "regular", guessSeconds: 12, revealSeconds: 5 } }, 89))).toBe(false);
    const buzzing = base({}, 89);
    expect(shouldRevealEarly({ ...buzzing, buzz: { ...buzzing.buzz, playerId: 1 } })).toBe(false);
  });

  it("needs a known duration and a song still guessing", () => {
    expect(shouldRevealEarly(base({}, 89, null))).toBe(false);
    expect(shouldRevealEarly(base({ phase: "revealed" }, 89))).toBe(false);
  });
});
