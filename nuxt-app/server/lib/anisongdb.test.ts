import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchArtistCatalog, fetchThemesByMalId, relevance, searchArtists, searchSongs, toThemeSlot } from "./anisongdb.ts";

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

const songEntry = (overrides: Record<string, unknown> = {}) => ({
  ...entry(),
  annSongId: 500,
  songName: "Gurenge",
  songArtist: "LiSA",
  animeENName: "Demon Slayer: Kimetsu no Yaiba",
  animeJPName: "Kimetsu no Yaiba",
  ...overrides,
});

describe("AnisongDB song search", () => {
  it("maps a match onto the app's shape and asks only for openings and endings", async () => {
    respond([songEntry()]);
    expect(await searchSongs("Gurenge")).toEqual([{
      annSongId: 500,
      themeSlot: "OP1",
      songTitle: "Gurenge",
      artistName: "LiSA",
      animeAniListId: 1,
      animeTitleRomaji: "Kimetsu no Yaiba",
      videoUrl: `${HOST}/byvisp.webm`,
      audioUrl: `${HOST}/qi299l.mp3`,
    }]);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({
      song_name_search_filter: { search: "Gurenge", partial_match: true },
      filters: { song_types: ["opening", "ending"] },
      ignore_duplicate: true,
    });
    expect(fetch.mock.calls[0]![0]).toBe("https://anisongdb.com/api/search_request");
  });

  it("ranks exact, then prefix, then substring, then everything else", async () => {
    respond([
      songEntry({ annSongId: 1, songName: "Not Related", linked_ids: { anilist: 11 } }),
      songEntry({ annSongId: 2, songName: "My Love Song", linked_ids: { anilist: 12 } }),
      songEntry({ annSongId: 3, songName: "Love Story", linked_ids: { anilist: 13 } }),
      songEntry({ annSongId: 4, songName: "Love", linked_ids: { anilist: 14 } }),
    ]);
    expect((await searchSongs("love")).map((r) => r.songTitle))
      .toEqual(["Love", "Love Story", "My Love Song", "Not Related"]);
  });

  it("breaks a relevance tie on the lowest annSongId", async () => {
    respond([
      songEntry({ annSongId: 90, songName: "Love", linked_ids: { anilist: 11 } }),
      songEntry({ annSongId: 20, songName: "Love", linked_ids: { anilist: 12 } }),
    ]);
    expect((await searchSongs("love")).map((r) => r.annSongId)).toEqual([20, 90]);
  });

  it("ignores punctuation, case and accents when ranking", async () => {
    respond([songEntry({ songName: "Déjà Vu" })]);
    expect(await searchSongs("deja-vu")).toEqual([expect.objectContaining({ songTitle: "Déjà Vu" })]);
    expect(relevance("Déjà Vu", "deja-vu")).toBe(0);
  });

  it("caps a broad query at ten results", async () => {
    respond(Array.from({ length: 40 }, (_, i) => songEntry({ annSongId: i, linked_ids: { anilist: 100 + i } })));
    expect(await searchSongs("Gurenge")).toHaveLength(10);
  });

  it("collapses a rebroadcast onto the same anime and slot, keeping the richer copy", async () => {
    respond([
      songEntry({ annSongId: 10, isRebroadcast: true, HQ: "rerun.webm" }),
      songEntry({ annSongId: 99, HQ: "original.webm" }),
    ]);
    expect(await searchSongs("Gurenge")).toEqual([expect.objectContaining({ videoUrl: `${HOST}/original.webm` })]);
  });

  it("keeps the same song in a different anime as its own result", async () => {
    respond([songEntry({ annSongId: 1 }), songEntry({ annSongId: 2, linked_ids: { anilist: 77 } })]);
    expect((await searchSongs("Gurenge")).map((r) => r.animeAniListId)).toEqual([1, 77]);
  });

  it("falls back to the English anime title when the romanized one is missing", async () => {
    respond([songEntry({ animeJPName: "  " })]);
    expect(await searchSongs("Gurenge"))
      .toEqual([expect.objectContaining({ animeTitleRomaji: "Demon Slayer: Kimetsu no Yaiba" })]);
  });

  it.each([
    ["a dub", { isDub: true }],
    ["an insert song", { songType: "Insert Song" }],
    ["an entry with no AniList mapping", { linked_ids: { myanimelist: 1 } }],
    ["an entry with no playable media", { HQ: null, MQ: null, audio: null }],
    ["an entry with no annSongId", { annSongId: null }],
    ["an entry with no song name", { songName: "  " }],
    ["an entry with no anime title at all", { animeJPName: null, animeENName: null }],
  ])("drops %s", async (_label, overrides) => {
    respond([songEntry(overrides)]);
    expect(await searchSongs("Gurenge")).toEqual([]);
  });

  it.each([
    ["a network failure", () => fetch.mockRejectedValue(new Error("boom"))],
    ["a 503", () => fetch.mockResolvedValue(new Response("", { status: 503 }))],
    ["a non-array body", () => fetch.mockResolvedValue(Response.json({ detail: "nope" }))],
  ])("shares the theme lookup's failure classification for %s", async (_label, arrange) => {
    arrange();
    await expect(searchSongs("Gurenge")).rejects.toMatchObject({ statusCode: 503 });
  });

  it("treats a rejected search as a request error, not an outage", async () => {
    fetch.mockResolvedValue(new Response("", { status: 422 }));
    await expect(searchSongs("Gurenge")).rejects.not.toMatchObject({ statusCode: 503 });
  });
});

const performed = (artists: unknown[], overrides: Record<string, unknown> = {}) =>
  songEntry({ artists, ...overrides });

const artist = (id: number, ...names: string[]) => ({ id, names, line_up_id: 0, groups: null, members: null });

describe("AnisongDB artist search", () => {
  it("reduces matching entries to distinct artists and asks only for openings and endings", async () => {
    respond([
      performed([artist(8355, "YOASOBI")], { linked_ids: { anilist: 1 } }),
      performed([artist(8355, "YOASOBI")], { linked_ids: { anilist: 2 } }),
    ]);
    expect(await searchArtists("YOASOBI")).toEqual([{ id: 8355, name: "YOASOBI" }]);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({
      artist_search_filter: { search: "YOASOBI", partial_match: true },
      filters: { song_types: ["opening", "ending"] },
      ignore_duplicate: true,
    });
  });

  it("drops a collaborator whose own name does not match the query", async () => {
    respond([performed([artist(4885, "LiSA"), artist(2537, "m-flo"), artist(5173, "Hyadain")])]);
    expect(await searchArtists("LiSA")).toEqual([{ id: 4885, name: "LiSA" }]);
  });

  it("keeps a near-miss that genuinely contains the query", async () => {
    respond([performed([artist(806, "ELISA")]), performed([artist(4885, "LiSA")], { linked_ids: { anilist: 2 } })]);
    expect(await searchArtists("LiSA")).toEqual([{ id: 4885, name: "LiSA" }, { id: 806, name: "ELISA" }]);
  });

  it("matches on any of an artist's romanizations but reports the primary name", async () => {
    respond([performed([artist(8798, "ano", "Ano (You'll Melt More!)")])]);
    expect(await searchArtists("you'll melt more")).toEqual([{ id: 8798, name: "ano" }]);
  });

  it("ranks a more prolific artist first when relevance ties", async () => {
    respond([
      performed([artist(2, "LiSA Two")], { linked_ids: { anilist: 1 } }),
      performed([artist(1, "LiSA One")], { linked_ids: { anilist: 2 } }),
      performed([artist(1, "LiSA One")], { linked_ids: { anilist: 3 } }),
    ]);
    expect((await searchArtists("LiSA")).map((a) => a.id)).toEqual([1, 2]);
  });

  it("caps a broad query at ten artists", async () => {
    respond(Array.from({ length: 25 }, (_, i) =>
      performed([artist(i + 1, `LiSA ${i}`)], { linked_ids: { anilist: i + 1 } })));
    expect(await searchArtists("LiSA")).toHaveLength(10);
  });

  it.each([
    ["a dub entry", { isDub: true }],
    ["an entry with no artists array", { artists: null }],
  ])("ignores %s", async (_label, overrides) => {
    respond([songEntry({ artists: [artist(4885, "LiSA")], ...overrides })]);
    expect(await searchArtists("LiSA")).toEqual([]);
  });

  it.each([
    ["an artist with no id", { names: ["LiSA"] }],
    ["an artist with no usable names", { id: 4885, names: ["  "] }],
  ])("skips %s", async (_label, broken) => {
    respond([performed([broken])]);
    expect(await searchArtists("LiSA")).toEqual([]);
  });

  it("shares the theme lookup's failure classification", async () => {
    fetch.mockRejectedValue(new Error("boom"));
    await expect(searchArtists("LiSA")).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("AnisongDB artist catalog", () => {
  it("returns every theme without ranking or capping them", async () => {
    respond(Array.from({ length: 25 }, (_, i) => songEntry({ annSongId: i, linked_ids: { anilist: i + 1 } })));
    expect(await fetchArtistCatalog(8355)).toHaveLength(25);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({
      artist_ids: [8355],
      filters: { song_types: ["opening", "ending"] },
      ignore_duplicate: true,
    });
    expect(fetch.mock.calls[0]![0]).toBe("https://anisongdb.com/api/artist_ids_request");
  });

  it("applies the same rejection and de-duplication rules as song search", async () => {
    respond([
      songEntry({ annSongId: 1, isDub: true }),
      songEntry({ annSongId: 2, songType: "Insert Song", linked_ids: { anilist: 2 } }),
      songEntry({ annSongId: 3, linked_ids: { myanimelist: 1 } }),
      songEntry({ annSongId: 4, isRebroadcast: true, HQ: "rerun.webm" }),
      songEntry({ annSongId: 5, HQ: "original.webm" }),
    ]);
    expect(await fetchArtistCatalog(8355)).toEqual([expect.objectContaining({ videoUrl: `${HOST}/original.webm` })]);
  });

  it.each([0, -1, 1.5])("rejects %s as an artist id", async (id) => {
    await expect(fetchArtistCatalog(id)).rejects.toThrow("positive integer");
  });
});
