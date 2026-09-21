import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportImportProgress } from "../../utils/importProgress";

const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  resolveArtistThemes: vi.fn(),
  byAniListId: vi.fn(),
  getClipSource: vi.fn(),
  upsertSong: vi.fn(),
  startLoads: vi.fn(),
}));
vi.mock("../../utils/importProgress.ts", () => ({
  respondWithImportProgress: (_event: unknown, run: (report: ReportImportProgress) => Promise<unknown>) => run(mocks.report),
}));
vi.mock("../../utils/artistSource.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/artistSource.ts")>()),
  resolveArtistThemes: mocks.resolveArtistThemes,
}));
vi.mock("../../utils/animeMetadata.ts", () => ({
  createAnimeMetadataResolver: () => mocks,
  AnimeLookupUnavailableError: class extends Error {},
}));
vi.mock("../../utils/lookup.ts", () => ({
  getOrCreateArtist: (name: string) => ({ id: 1, name }),
  upsertAnime: (anime: { aniListId: number }) => ({ id: anime.aniListId, ...anime }),
  upsertSong: mocks.upsertSong,
}));
vi.mock("../../utils/themeSource.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/themeSource.ts")>()),
  startMatchIndexLoads: mocks.startLoads,
}));
vi.mock("../../utils/mediaLibrary.ts", () => ({ getClipSource: mocks.getClipSource }));

const matchIndex = (titles: Record<string, number>) =>
  Promise.resolve({ status: "ok", animethemesId: 1502, byTitle: new Map(Object.entries(titles)) });

const anisongCandidate = { source: "anisongdb", id: 8355, name: "YOASOBI", slug: null };

async function importArtist(body: unknown) {
  vi.stubGlobal("readBody", async () => body);
  const route = (await import("./artist-import.post")).default;
  return route({} as Parameters<typeof route>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("createError", (input: { statusMessage: string }) => Object.assign(new Error(input.statusMessage), input));
  mocks.byAniListId.mockResolvedValue({ aniListId: 114194, titleRomaji: "Beastars" });
  mocks.resolveArtistThemes.mockResolvedValue({
    artistName: "YOASOBI",
    entries: [{
      animethemesThemeId: null,
      themeSlot: "OP1",
      songTitle: "Kaibutsu",
      songTitleNative: null,
      animeAniListId: 114194,
      animeAnimethemesId: null,
      animeTitleRomaji: "Beastars",
      videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
      audioUrl: null,
    }],
  });
  mocks.getClipSource.mockReturnValue("both");
  mocks.upsertSong.mockImplementation((song: object) => ({ id: 1, ...song }));
  mocks.startLoads.mockImplementation((ids: number[]) => new Map(ids.map((id) => [id, matchIndex({ kaibutsu: 9139 })])));
});
afterEach(() => vi.unstubAllGlobals());

describe("artist import request validation", () => {
  it("passes the whole candidate through to the resolver", async () => {
    await expect(importArtist({ candidate: anisongCandidate })).resolves.toMatchObject({ artistName: "YOASOBI" });
    expect(mocks.resolveArtistThemes).toHaveBeenCalledWith(anisongCandidate);
  });

  it("names the provider it is about to ask", async () => {
    await importArtist({ candidate: anisongCandidate });
    expect(mocks.report).toHaveBeenCalledWith({ label: "Fetching artist catalog from AnisongDB" });
  });

  it("imports a theme that carries no AnimeThemes ids", async () => {
    const result = await importArtist({ candidate: anisongCandidate }) as { animeGroups: unknown[] };
    expect(result.animeGroups).toEqual([expect.objectContaining({
      themes: [expect.objectContaining({ themeSlot: "OP1", videoUrl: "https://naedist.animemusicquiz.com/fast.webm" })],
    })]);
  });

  it("reports an artist the resolver cannot find", async () => {
    mocks.resolveArtistThemes.mockResolvedValue(null);
    await expect(importArtist({ candidate: { source: "animethemes", id: 1, name: "Gone", slug: "gone" } }))
      .rejects.toThrow("Artist not found");
  });

  it.each([
    ["no body", null],
    ["the old artistSlug shape", { artistSlug: "yoasobi" }],
    ["a candidate that is not an object", { candidate: "yoasobi" }],
    ["an unknown provider", { candidate: { ...anisongCandidate, source: "spotify" } }],
    ["an AnimeThemes candidate with no slug", { candidate: { source: "animethemes", id: 1, name: "x", slug: null } }],
  ])("rejects a request with %s", async (_label, body) => {
    await expect(importArtist(body)).rejects.toThrow("candidate is required");
    expect(mocks.resolveArtistThemes).not.toHaveBeenCalled();
  });
});

describe("artist import clip filtering", () => {
  it("drops a theme's URL and reports clipBlocked when the setting excludes its host", async () => {
    mocks.getClipSource.mockReturnValue("animethemes");
    const result = await importArtist({ candidate: anisongCandidate }) as { animeGroups: { themes: unknown[] }[] };
    expect(result.animeGroups[0]!.themes).toEqual([expect.objectContaining({
      videoUrl: null,
      audioUrl: null,
      clipBlocked: true,
    })]);
  });

  it("keeps a theme's URL and reports not blocked when the setting allows its host", async () => {
    mocks.getClipSource.mockReturnValue("anisongdb");
    const result = await importArtist({ candidate: anisongCandidate }) as { animeGroups: { themes: unknown[] }[] };
    expect(result.animeGroups[0]!.themes).toEqual([expect.objectContaining({
      videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
      clipBlocked: false,
    })]);
  });
});

describe("artist import AnimeThemes match gate", () => {
  type Group = { themes: { songTitle: string; noAnimethemesMatch: boolean }[] };
  const run = async () => (await importArtist({ candidate: anisongCandidate }) as { animeGroups: Group[] }).animeGroups[0]!.themes;
  const entry = (overrides: object) => ({
    animethemesThemeId: null,
    themeSlot: "OP1",
    songTitle: "Kaibutsu",
    songTitleNative: null,
    animeAniListId: 114194,
    animeAnimethemesId: null,
    animeTitleRomaji: "Beastars",
    videoUrl: null,
    audioUrl: null,
    ...overrides,
  });
  const resolveEntries = (...entries: object[]) =>
    mocks.resolveArtistThemes.mockResolvedValue({ artistName: "YOASOBI", entries });

  it("stores the AnimeThemes theme id it finds and does not flag the song", async () => {
    expect(await run()).toEqual([expect.objectContaining({ noAnimethemesMatch: false })]);
    expect(mocks.upsertSong).toHaveBeenCalledWith(expect.objectContaining({ animethemesThemeId: 9139 }));
  });

  it("flags a song AnimeThemes does not have and stores no id for it", async () => {
    resolveEntries(entry({ songTitle: "Kaibutsu" }), entry({ themeSlot: "ED1", songTitle: "Only On AnisongDB" }));
    expect(await run()).toEqual([
      expect.objectContaining({ songTitle: "Kaibutsu", noAnimethemesMatch: false }),
      expect.objectContaining({ songTitle: "Only On AnisongDB", noAnimethemesMatch: true }),
    ]);
    expect(mocks.upsertSong).toHaveBeenLastCalledWith(expect.objectContaining({ animethemesThemeId: null }));
  });

  it("fails open for every song of an anime whose lookup was unavailable", async () => {
    mocks.startLoads.mockImplementation((ids: number[]) => new Map(ids.map((id) => [id, Promise.resolve({ status: "unavailable" })])));
    expect(await run()).toEqual([expect.objectContaining({ noAnimethemesMatch: false })]);
  });

  it("does not gate a song a previous import already matched", async () => {
    mocks.startLoads.mockImplementation((ids: number[]) => new Map(ids.map((id) => [id, matchIndex({})])));
    mocks.upsertSong.mockImplementation((song: object) => ({ id: 1, ...song, animethemesThemeId: 555 }));
    expect(await run()).toEqual([expect.objectContaining({ noAnimethemesMatch: false })]);
  });

  it("asks for no lookup at all when every entry already carries an AnimeThemes id", async () => {
    resolveEntries(entry({ animethemesThemeId: 77 }));
    expect(await run()).toEqual([expect.objectContaining({ noAnimethemesMatch: false })]);
    expect(mocks.startLoads).toHaveBeenCalledWith([]);
    expect(mocks.upsertSong).toHaveBeenCalledWith(expect.objectContaining({ animethemesThemeId: 77 }));
  });

  it("looks up each anime once, however many of its songs need checking", async () => {
    resolveEntries(entry({}), entry({ themeSlot: "ED1", songTitle: "Other" }), entry({ animeAniListId: 999 }));
    mocks.byAniListId.mockImplementation(async (id: number) => ({ aniListId: id, titleRomaji: "x" }));
    await importArtist({ candidate: anisongCandidate });
    expect(mocks.startLoads).toHaveBeenCalledWith([114194, 999]);
  });

  it("surfaces a lookup fault that is not an outage instead of importing past it", async () => {
    mocks.startLoads.mockImplementation((ids: number[]) => new Map(ids.map((id) => [id, Promise.reject(new Error("AnimeThemes rejected the request (422)."))])));
    await expect(importArtist({ candidate: anisongCandidate })).rejects.toThrow("rejected the request");
  });
});
