import { describe, expect, it } from "vitest";
import type { CardWithDetails } from "../composables/useStudySession";
import { catalogListenTrack, libraryListenTrack, listenCard, listenTrackUnavailableReason, mediaLibraryCardId, type ListenCatalogSong } from "./listenRequests";

const remote = "https://naedist.animemusicquiz.com/song.webm";
export const catalogSong = (patch: Partial<ListenCatalogSong> = {}): ListenCatalogSong => ({
  resultKey: "adb:17", animethemesThemeId: null, themeSlot: "OP1", songTitle: "Song",
  songTitleNative: null, artistName: "Artist", animeAniListId: 10, animeAnimethemesId: null,
  animeTitleRomaji: "Show", videoUrl: remote, audioUrl: null, clipBlocked: false, ...patch,
});

describe("Listen track projections", () => {
  it("keeps real library targets, metadata, and local media", () => {
    const card = { id: 9, songTitle: "My title", localVideoPath: "/library/song.webm", notes: "Memory" } as CardWithDetails;
    const track = libraryListenTrack(card);
    const mapped = listenCard({ entryId: 20, origin: "request", track });
    expect(track.key).toBe("card:9");
    expect(mapped).toMatchObject({ id: 9, libraryCardId: 9, songTitle: "My title", localVideoPath: "/library/song.webm", notes: "Memory" });
    expect(mediaLibraryCardId(mapped)).toBe(9);
  });

  it("plays catalog media without pretending it has a card or schedule", () => {
    const track = catalogListenTrack(catalogSong());
    const mapped = listenCard({ entryId: 20, origin: "request", track });
    expect(mapped).toMatchObject({ id: -20, libraryCardId: null, animethemesVideoUrl: remote, artistId: null, animeId: null });
    expect(mapped).not.toHaveProperty("box");
    expect(mapped).not.toHaveProperty("nextReviewAt");
    expect(mediaLibraryCardId(mapped)).toBeNull();
    expect(listenCard({ entryId: 21, origin: "request", track }).id).toBe(-21);
  });

  it("distinguishes shows, slots, and provider identities despite equal titles", () => {
    const tracks = [catalogSong(), catalogSong({ animeAniListId: 11 }), catalogSong({ themeSlot: "ED1" }), catalogSong({ resultKey: "at:17" })].map(catalogListenTrack);
    expect(new Set(tracks.map((track) => track.key)).size).toBe(4);
  });

  it("uses honest fallbacks for missing metadata", () => {
    const track = catalogListenTrack(catalogSong({ songTitle: null, artistName: null }));
    expect(listenCard({ entryId: 1, origin: "request", track })).toMatchObject({
      songTitle: "Unknown song", artistName: "Unknown artist", songTitleNative: "", animeTitleNative: "", animeCoverImageUrl: null,
    });
  });

  it("respects host restrictions and blocked or missing sources", () => {
    expect(listenTrackUnavailableReason(catalogListenTrack(catalogSong()), "anisongdb")).toBeNull();
    expect(listenTrackUnavailableReason(catalogListenTrack(catalogSong()), "animethemes")).toContain("No playable");
    expect(listenTrackUnavailableReason(catalogListenTrack(catalogSong({ clipBlocked: true })), "both")).toContain("Blocked");
    expect(listenTrackUnavailableReason(catalogListenTrack(catalogSong({ videoUrl: null })), "both")).toContain("No playable");
  });

  it("rejects non-card identities and explicitly read-only real IDs", () => {
    for (const id of [0, -1, 1.5, NaN, Infinity]) expect(mediaLibraryCardId({ id })).toBeNull();
    expect(mediaLibraryCardId({ id: 7 }, true)).toBeNull();
    expect(mediaLibraryCardId({ id: 7, libraryCardId: null })).toBeNull();
    expect(mediaLibraryCardId({ id: 7 })).toBe(7);
  });
});
