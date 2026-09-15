import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ byAniListId: vi.fn(), upsertAnime: vi.fn(), upsertSong: vi.fn(), getClipSource: vi.fn() }));
vi.mock("../../utils/animeMetadata.ts", () => ({ createAnimeMetadataResolver: () => mocks }));
vi.mock("../../utils/cards.ts", () => ({ getCardsBySongIds: () => [] }));
vi.mock("../../utils/lookup.ts", () => ({
  getOrCreateArtist: (name: string) => ({ id: 1, name }),
  upsertAnime: mocks.upsertAnime,
  upsertSong: mocks.upsertSong,
}));
vi.mock("../../utils/mediaLibrary.ts", () => ({ getClipSource: mocks.getClipSource }));

const anisongBody = {
  resultKey: "adb:31487",
  animethemesThemeId: null,
  themeSlot: "OP1",
  songTitle: "Kaibutsu",
  songTitleNative: null,
  artistName: "YOASOBI",
  animeAniListId: 114194,
  animeAnimethemesId: null,
  videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
  audioUrl: null,
};

async function importSong(body: unknown) {
  vi.stubGlobal("readBody", async () => body);
  const route = (await import("./song-import.post")).default;
  return route({} as Parameters<typeof route>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("createError", (input: { statusMessage: string }) => Object.assign(new Error(input.statusMessage), input));
  mocks.byAniListId.mockResolvedValue({ aniListId: 114194, titleRomaji: "Beastars", animethemesId: null });
  mocks.upsertAnime.mockImplementation((anime) => ({ id: 7, ...anime }));
  mocks.upsertSong.mockImplementation((song) => ({ id: 42, ...song }));
  mocks.getClipSource.mockReturnValue("both");
});
afterEach(() => vi.unstubAllGlobals());

describe("song import request validation", () => {
  it("accepts an AnisongDB result that carries neither AnimeThemes id", async () => {
    await expect(importSong(anisongBody)).resolves.toMatchObject({ songId: 42, videoUrl: anisongBody.videoUrl });
    expect(mocks.upsertSong).toHaveBeenCalledWith(expect.objectContaining({ animethemesThemeId: null, themeSlot: "OP1" }));
    expect(mocks.upsertAnime).toHaveBeenCalledWith(expect.objectContaining({ animethemesId: null }));
  });

  it("still carries an AnimeThemes result's ids through", async () => {
    await importSong({ ...anisongBody, animethemesThemeId: 9139, animeAnimethemesId: 1502 });
    expect(mocks.upsertSong).toHaveBeenCalledWith(expect.objectContaining({ animethemesThemeId: 9139 }));
    expect(mocks.upsertAnime).toHaveBeenCalledWith(expect.objectContaining({ animethemesId: 1502 }));
  });

  it("prefers the anime's own AnimeThemes id over the one the result carried", async () => {
    mocks.byAniListId.mockResolvedValue({ aniListId: 114194, titleRomaji: "Beastars", animethemesId: 888 });
    await importSong({ ...anisongBody, animeAnimethemesId: 1502 });
    expect(mocks.upsertAnime).toHaveBeenCalledWith(expect.objectContaining({ animethemesId: 888 }));
  });

  it.each([
    ["no body", null],
    ["no AniList id", { ...anisongBody, animeAniListId: undefined }],
    ["a non-numeric AniList id", { ...anisongBody, animeAniListId: "114194" }],
    ["no theme slot", { ...anisongBody, themeSlot: undefined }],
    ["a blank theme slot", { ...anisongBody, themeSlot: "  " }],
  ])("rejects a request with %s", async (_label, body) => {
    await expect(importSong(body)).rejects.toThrow("Invalid song import request");
  });
});

describe("song import clip filtering", () => {
  it("re-filters the request body's URL rather than trusting it, when the setting has since changed", async () => {
    // The client just echoes back a search result. If the Clip source setting
    // narrowed between search and click, the stale AMQ URL must not survive.
    mocks.getClipSource.mockReturnValue("animethemes");
    await expect(importSong(anisongBody)).resolves.toMatchObject({ videoUrl: null, audioUrl: null });
  });

  it("keeps a URL the current setting still allows", async () => {
    mocks.getClipSource.mockReturnValue("anisongdb");
    await expect(importSong(anisongBody)).resolves.toMatchObject({ videoUrl: anisongBody.videoUrl });
  });
});
