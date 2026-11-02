import type { CardWithDetails } from "../composables/useStudySession";
import type { ClipSource } from "./clipSource";
import { isPlayableCard } from "./listenQueue";

export interface ListenCatalogSong {
  resultKey: string;
  animethemesThemeId: number | null;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  animeAniListId: number;
  animeAnimethemesId: number | null;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
  clipBlocked: boolean;
}

export type ListenTrack =
  | { kind: "library"; key: string; card: CardWithDetails }
  | { kind: "catalog"; key: string; song: ListenCatalogSong };

export interface ListenQueueEntry {
  entryId: number;
  origin: "deck" | "request";
  track: ListenTrack;
}

export type ListenMediaCard = Pick<CardWithDetails,
  "id" | "localVideoPath" | "localAudioPath" | "animethemesVideoUrl" |
  "animethemesAudioUrl" | "themeSlot" | "animeCoverImageUrl"
> & { libraryCardId?: number | null };

export type ListenCard = Omit<CardWithDetails,
  "songId" | "artistId" | "animeId" | "suspended" | "known" | "status" |
  "box" | "streak" | "nextReviewAt" | "createdAt"
> & { libraryCardId: number | null; artistId: number | null; animeId: number | null };

export function libraryListenTrack(card: CardWithDetails): ListenTrack {
  return { kind: "library", key: `card:${card.id}`, card };
}

export function catalogListenTrack(song: ListenCatalogSong): ListenTrack {
  return { kind: "catalog", key: `catalog:${song.resultKey}:${song.animeAniListId}:${song.themeSlot}`, song };
}

export function listenCard(entry: ListenQueueEntry): ListenCard {
  const { track } = entry;
  if (track.kind === "library") return { ...track.card, libraryCardId: track.card.id };
  const { song } = track;
  return {
    id: -entry.entryId,
    libraryCardId: null,
    localVideoPath: null,
    localAudioPath: null,
    animethemesVideoUrl: song.videoUrl,
    animethemesAudioUrl: song.audioUrl,
    notes: null,
    songTitle: song.songTitle || "Unknown song",
    songTitleNative: song.songTitleNative || "",
    themeSlot: song.themeSlot,
    artistId: null,
    artistName: song.artistName || "Unknown artist",
    animeId: null,
    animeAniListId: song.animeAniListId,
    animeAnimethemesSlug: null,
    animethemesVideoSlug: null,
    animeTitleEnglish: song.animeTitleRomaji,
    animeTitleRomaji: song.animeTitleRomaji,
    animeTitleNative: "",
    animeCoverImageUrl: null,
    animeYear: null,
    animeStudios: [],
    animeTags: [],
  };
}

export function mediaLibraryCardId(card: Pick<ListenMediaCard, "id" | "libraryCardId">, readOnly = false): number | null {
  const id = card.libraryCardId === undefined ? card.id : card.libraryCardId;
  return !readOnly && id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function listenTrackUnavailableReason(track: ListenTrack, clipSource: ClipSource): string | null {
  if (track.kind === "catalog" && track.song.clipBlocked) return "Blocked by your Clip source setting.";
  return isPlayableCard(listenCard({ entryId: 1, origin: "request", track }), clipSource)
    ? null : "No playable clip with your Clip source setting.";
}
