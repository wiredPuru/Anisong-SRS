import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchThemesByMalId, toThemeSlot } from "./anisongdb.ts";

const HOST = "https://naedist.animemusicquiz.com";

const entry = (overrides: Record<string, unknown> = {}) => ({
  annSongId: 25,
  songType: "Opening 1",
  songName: "Tank!",
  songArtist: "Seatbelts",
  isDub: false,
  isRebroadcast: false,
  linked_ids: { myanimelist: 1, anilist: 1 },
  HQ: "byvisp.webm",
  MQ: "t0nxjm.webm",
  audio: "qi299l.mp3",
  ...overrides,
});

const fetch = vi.fn();
beforeEach(() => { fetch.mockReset(); vi.stubGlobal("fetch", fetch); });
afterEach(() => vi.unstubAllGlobals());

const respond = (entries: unknown[]) => fetch.mockResolvedValue(Response.json(entries));
const themes = () => fetchThemesByMalId(1, 1);

describe("AnisongDB theme slots", () => {
  it.each([
    ["Opening 1", "OP1"],
    ["Ending 12", "ED12"],
    [" Ending 2 ", "ED2"],
    ["Insert Song", null],
    ["Opening", null],
    ["Opening one", null],
    [null, null],
  ])("maps %s to %s", (songType, expected) => {
    expect(toThemeSlot(songType)).toBe(expected);
  });
});

describe("AnisongDB theme resolution", () => {
  it("maps a broadcast theme onto the app's shape", async () => {
    respond([entry()]);
    expect(await themes()).toEqual([{
      themeSlot: "OP1",
      songTitle: "Tank!",
      artistName: "Seatbelts",
      videoUrl: `${HOST}/byvisp.webm`,
      audioUrl: `${HOST}/qi299l.mp3`,
    }]);
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body).toEqual({ mal_ids: [1], ignore_duplicate: true });
  });

  it("falls back to MQ when HQ is missing, and drops an entry with no media at all", async () => {
    respond([entry({ HQ: null }), entry({ songType: "Ending 1", HQ: null, MQ: null, audio: null })]);
    expect(await themes()).toEqual([expect.objectContaining({ themeSlot: "OP1", videoUrl: `${HOST}/t0nxjm.webm` })]);
  });

  it("leaves videoUrl null when only audio exists", async () => {
    respond([entry({ HQ: null, MQ: null })]);
    expect(await themes()).toEqual([expect.objectContaining({ videoUrl: null, audioUrl: `${HOST}/qi299l.mp3` })]);
  });

  it.each([
    ["a dub", { isDub: true }],
    ["an insert song", { songType: "Insert Song" }],
    ["a different anime's MAL id", { linked_ids: { myanimelist: 2, anilist: 1 } }],
    ["a different anime's AniList id", { linked_ids: { myanimelist: 1, anilist: 2 } }],
    ["a missing AniList mapping", { linked_ids: { myanimelist: 1 } }],
    ["an unusable linked_ids", { linked_ids: null }],
  ])("skips %s", async (_label, overrides) => {
    respond([entry(overrides)]);
    expect(await themes()).toEqual([]);
  });

  it.each([
    ["a path traversal", "../../etc/passwd"],
    ["a host hop", "//evil.test/x.webm"],
    ["an absolute URL", "https://evil.test/x.webm"],
    ["a non-string", 12],
  ])("refuses to build a media URL from %s", async (_label, HQ) => {
    respond([entry({ HQ, MQ: null })]);
    expect(await themes()).toEqual([expect.objectContaining({ videoUrl: null })]);
  });

  it("keeps the richest entry when two map to the same slot", async () => {
    respond([entry({ annSongId: 10, HQ: null, MQ: null }), entry({ annSongId: 99, HQ: "best.webm" })]);
    expect(await themes()).toEqual([expect.objectContaining({ videoUrl: `${HOST}/best.webm` })]);
  });

  it("prefers a broadcast copy over an equally sourced rebroadcast", async () => {
    respond([entry({ annSongId: 10, isRebroadcast: true, HQ: "rerun.webm" }), entry({ annSongId: 99, HQ: "original.webm" })]);
    expect(await themes()).toEqual([expect.objectContaining({ videoUrl: `${HOST}/original.webm` })]);
  });

  it("breaks a tie on the lowest annSongId, not on string order", async () => {
    respond([entry({ annSongId: 9, HQ: "later.webm" }), entry({ annSongId: 10, HQ: "earlier.webm" })]);
    expect(await themes()).toEqual([expect.objectContaining({ videoUrl: `${HOST}/later.webm` })]);
  });

  it("returns an empty list for an anime AnisongDB does not have", async () => {
    respond([]);
    expect(await themes()).toEqual([]);
  });

  it.each([403, 429, 500, 503])("treats HTTP %i as unavailable", async (status) => {
    fetch.mockResolvedValue(new Response("", { status }));
    await expect(themes()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("carries a Retry-After through a 429", async () => {
    fetch.mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "120" } }));
    await expect(themes()).rejects.toMatchObject({ retryAfterMs: 120_000 });
  });

  it.each([
    ["a network failure", () => fetch.mockRejectedValue(new Error("boom"))],
    ["unparseable JSON", () => fetch.mockResolvedValue(new Response("not json"))],
    ["a non-array body", () => fetch.mockResolvedValue(Response.json({ detail: "nope" }))],
  ])("treats %s as unavailable", async (_label, arrange) => {
    arrange();
    await expect(themes()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("treats a rejected request as a request error, not an outage", async () => {
    fetch.mockResolvedValue(new Response("", { status: 422 }));
    await expect(themes()).rejects.not.toMatchObject({ statusCode: 503 });
  });

  it.each([0, -1, 1.5])("rejects %s as an anime id", async (id) => {
    await expect(fetchThemesByMalId(id, 1)).rejects.toThrow("positive integer");
    await expect(fetchThemesByMalId(1, id)).rejects.toThrow("positive integer");
  });
});
