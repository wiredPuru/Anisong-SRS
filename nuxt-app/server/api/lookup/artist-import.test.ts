import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportImportProgress } from "../../utils/importProgress";

const mocks = vi.hoisted(() => ({ report: vi.fn(), resolveArtistThemes: vi.fn(), byAniListId: vi.fn(), getClipSource: vi.fn() }));
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
  upsertSong: (song: unknown) => ({ id: 1, ...(song as object) }),
}));
vi.mock("../../utils/mediaLibrary.ts", () => ({ getClipSource: mocks.getClipSource }));

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
