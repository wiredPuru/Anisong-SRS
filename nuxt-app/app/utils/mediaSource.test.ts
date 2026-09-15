import { describe, expect, it } from "vitest";
import { resolveRemotePrefetchUrl, type RemoteSourceCard } from "./mediaSource";

const AMQ_VIDEO = "https://naedist.animemusicquiz.com/byvisp.webm";
const AMQ_AUDIO = "https://naedist.animemusicquiz.com/qi299l.mp3";
const ANIMETHEMES_VIDEO = "https://v.animethemes.moe/CowboyBebop-OP1.webm";
const ANIMETHEMES_AUDIO = "https://a.animethemes.moe/CowboyBebop-OP1.ogg";

function makeCard(overrides: Partial<RemoteSourceCard> = {}): RemoteSourceCard {
  return {
    localVideoPath: null,
    localAudioPath: null,
    animethemesVideoUrl: null,
    animethemesAudioUrl: null,
    ...overrides,
  };
}

describe("resolveRemotePrefetchUrl - existing behavior", () => {
  it("prefers a remote video source over audio", () => {
    const card = makeCard({ animethemesVideoUrl: AMQ_VIDEO, animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card)).toBe(AMQ_VIDEO);
  });

  it("returns null for a local video source (nothing to prefetch)", () => {
    const card = makeCard({ localVideoPath: "/library/clip.mp4", animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card)).toBeNull();
  });

  it("falls back to remote audio when there is no video source at all", () => {
    const card = makeCard({ animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card)).toBe(AMQ_AUDIO);
  });

  it("returns null for a card with no source", () => {
    expect(resolveRemotePrefetchUrl(makeCard())).toBeNull();
  });

  it("prefers remote audio over video when audioOnly is set and audio exists", () => {
    const card = makeCard({ animethemesVideoUrl: AMQ_VIDEO, animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card, true)).toBe(AMQ_AUDIO);
  });

  it("still falls back to video when audioOnly is set but the card has no audio source", () => {
    const card = makeCard({ animethemesVideoUrl: AMQ_VIDEO });
    expect(resolveRemotePrefetchUrl(card, true)).toBe(AMQ_VIDEO);
  });
});

describe("resolveRemotePrefetchUrl - clip source awareness", () => {
  it("skips a blocked video source and prefetches the allowed audio instead", () => {
    const card = makeCard({ animethemesVideoUrl: AMQ_VIDEO, animethemesAudioUrl: ANIMETHEMES_AUDIO });
    expect(resolveRemotePrefetchUrl(card, false, "animethemes")).toBe(ANIMETHEMES_AUDIO);
  });

  it("returns null when every remote source is blocked", () => {
    const card = makeCard({ animethemesVideoUrl: AMQ_VIDEO, animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card, false, "animethemes")).toBeNull();
  });

  it("a local file is never blocked by the setting", () => {
    const card = makeCard({ localVideoPath: "/library/clip.mp4", animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card, false, "animethemes")).toBeNull();
  });

  it("defaults to anisongdb when clipSource is omitted, matching the real server default", () => {
    const card = makeCard({ animethemesVideoUrl: ANIMETHEMES_VIDEO, animethemesAudioUrl: AMQ_AUDIO });
    expect(resolveRemotePrefetchUrl(card)).toBe(AMQ_AUDIO);
  });

  it("audioOnly still skips a blocked audio source and returns null rather than an unplayable URL", () => {
    const card = makeCard({ animethemesAudioUrl: ANIMETHEMES_AUDIO });
    expect(resolveRemotePrefetchUrl(card, true, "anisongdb")).toBeNull();
  });
});
