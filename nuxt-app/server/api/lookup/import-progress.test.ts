import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportImportProgress } from "../../utils/importProgress";
import { ProviderUnavailableError } from "../../lib/graphql";

const mocks = vi.hoisted(() => ({ report: vi.fn(), byAniListId: vi.fn(), byMalId: vi.fn(), upsertAnime: vi.fn(), upsertSong: vi.fn(), getClipSource: vi.fn() }));
vi.mock("../../utils/importProgress.ts", () => ({
  respondWithImportProgress: (_event: unknown, run: (report: ReportImportProgress) => Promise<unknown>) => run(mocks.report),
}));
vi.mock("../../utils/animeMetadata.ts", () => ({
  createAnimeMetadataResolver: () => mocks,
  AnimeLookupUnavailableError: class extends Error {},
}));
vi.mock("../../utils/lookup.ts", () => ({
  getOrCreateArtist: () => ({ id: 1 }), upsertAnime: mocks.upsertAnime, upsertSong: mocks.upsertSong,
}));
vi.mock("../../utils/mediaLibrary.ts", () => ({ getClipSource: mocks.getClipSource }));
vi.mock("../../lib/animethemes.ts", () => ({
  fetchArtistThemesBySlug: async () => ({ artistName: "Artist", entries: [1, 2, 3].map((id) => ({
    animeAniListId: id, animeAnimethemesId: id, songTitle: `Song ${id}`, themeSlot: "OP1", animethemesThemeId: id,
    videoUrl: null, audioUrl: null,
  })) }),
}));
vi.mock("../../lib/mal.ts", () => ({
  MalUserNotFoundError: class extends Error {},
  fetchMalCompletedList: async (_username: string, onPage: (page: number, count: number) => void) => {
    onPage(1, 3);
    return [1, 2, 3].map((malId) => ({ malId, title: `Anime ${malId}` }));
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("readBody", async () => ({
    candidate: { source: "animethemes", id: 1, name: "Artist", slug: "artist" },
  }));
  vi.stubGlobal("getQuery", () => ({ username: "test" }));
  vi.stubGlobal("createError", (input: { statusMessage: string }) => Object.assign(new Error(input.statusMessage), input));
  mocks.upsertAnime.mockImplementation((anime) => ({ id: anime.aniListId, ...anime }));
  mocks.upsertSong.mockImplementation((song) => ({ id: song.animethemesThemeId, ...song }));
  mocks.getClipSource.mockReturnValue("both");
});
afterEach(() => vi.unstubAllGlobals());

describe("actual import loop progress", () => {
  it("counts processed artist anime, separating missing mappings and provider failures", async () => {
    mocks.byAniListId.mockImplementation(async (id) => {
      if (id === 2) return null;
      if (id === 3) throw new ProviderUnavailableError("AniList");
      return { aniListId: id, titleRomaji: "First" };
    });
    const route = (await import("./artist-import.post")).default;
    const result = await route({} as Parameters<typeof route>[0]);
    expect(result).toMatchObject({ unavailableAnimeCount: 1, animeGroups: [{ anime: { aniListId: 1 } }] });
    expect(mocks.report.mock.calls.map(([event]) => event.completed).filter((value) => value !== undefined)).toEqual([0, 1, 2, 3]);
    expect(mocks.report).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 3, total: 3, skipped: 1, unavailable: 1 }));
    expect(mocks.upsertAnime).toHaveBeenCalledOnce();
  });

  it("reports list-page completion and counts missing or duplicate MAL mappings as skipped", async () => {
    mocks.byMalId.mockImplementation(async (id) => id === 2 ? null : { aniListId: 10, titleRomaji: "Same anime" });
    const route = (await import("./mal-list.get")).default;
    expect(await route({} as Parameters<typeof route>[0])).toMatchObject({ results: [{ aniListId: 10 }] });
    expect(mocks.report).toHaveBeenCalledWith({ label: "Fetched MyAnimeList page 1 (3 anime)" });
    expect(mocks.report).toHaveBeenLastCalledWith(expect.objectContaining({ completed: 3, total: 3, skipped: 2 }));
  });

  it("does not turn a MAL provider failure into a successful empty list", async () => {
    mocks.byMalId.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    const route = (await import("./mal-list.get")).default;
    await expect(route({} as Parameters<typeof route>[0])).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});
