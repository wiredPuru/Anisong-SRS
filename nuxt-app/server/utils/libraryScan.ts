import { basename, extname, normalize } from "node:path";
import { sanitizeSegment } from "./mediaDownload.ts";

export type ClipKind = "video" | "audio";

export interface ScanSong {
  songId: number;
  songTitle: string;
  animeTitleRomaji: string;
  themeSlot: string;
  artistName: string;
}

export interface RecoverCreate extends ScanSong {
  videoPath: string | null;
  audioPath: string | null;
}

export interface RecoverAttach extends ScanSong {
  cardId: number;
  kind: ClipKind;
  path: string;
}

export interface RecoverSkip {
  path: string;
  reason: "duplicate" | "unmatched" | "ambiguous";
  songTitle: string | null;
}

export interface LibraryScanResponse {
  scannedFiles: number;
  alreadyUsed: number;
  create: RecoverCreate[];
  attach: RecoverAttach[];
  skipped: RecoverSkip[];
  unreadableFolders: string[];
  truncated: boolean;
}

export interface ScanCard {
  id: number;
  songId: number;
  localVideoPath: string | null;
  localAudioPath: string | null;
}

export interface LibraryScanInput {
  files: string[];
  songs: ScanSong[];
  cards: ScanCard[];
}

export type LibraryScanPlan = Omit<LibraryScanResponse, "unreadableFolders" | "truncated">;

const VIDEO_EXTENSIONS = new Set([".webm", ".mp4", ".mkv", ".m4v", ".mov"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".oga", ".opus", ".m4a", ".aac", ".flac", ".wav"]);

export function clipKindForFile(name: string): ClipKind | null {
  const ext = extname(name).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return null;
}

// macOS can hand back decomposed (NFD) names, so both sides are NFC-folded.
function foldKey(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

export function matchKey(song: Pick<ScanSong, "animeTitleRomaji" | "themeSlot" | "artistName">): string {
  return foldKey(`${sanitizeSegment(song.animeTitleRomaji)} - ${sanitizeSegment(song.themeSlot)} - ${sanitizeSegment(song.artistName)}`);
}

const COPY_SUFFIX = / \((\d+)\)$/;

// resolveUniquePath writes "Name (2).ext" when "Name.ext" exists; copy 1 is the bare name.
export function parseFileKey(path: string): { key: string; copy: number } {
  const stem = basename(path, extname(path));
  const suffix = COPY_SUFFIX.exec(stem);
  return {
    key: foldKey(suffix ? stem.slice(0, suffix.index) : stem),
    copy: suffix ? Number(suffix[1]) : 1,
  };
}

function normalizePath(path: string): string {
  return normalize(path).normalize("NFC");
}

interface Candidate {
  path: string;
  kind: ClipKind;
  copy: number;
}

function byPreference(a: Candidate, b: Candidate): number {
  return a.copy - b.copy || a.path.localeCompare(b.path);
}

// Per kind, the best copy fills an empty slot; every other file is a duplicate.
function resolveSong(song: ScanSong, files: Candidate[], existing: ScanCard | undefined) {
  const winners: Partial<Record<ClipKind, string>> = {};
  const skipped: RecoverSkip[] = [];

  for (const kind of ["video", "audio"] as const) {
    const [winner, ...rest] = files.filter((f) => f.kind === kind).sort(byPreference);
    if (!winner) continue;
    const slotTaken = existing && (kind === "video" ? existing.localVideoPath : existing.localAudioPath);
    if (!slotTaken) winners[kind] = winner.path;
    for (const f of slotTaken ? [winner, ...rest] : rest) {
      skipped.push({ path: f.path, reason: "duplicate", songTitle: song.songTitle });
    }
  }

  const create: RecoverCreate[] = [];
  const attach: RecoverAttach[] = [];
  if (!existing) {
    if (winners.video || winners.audio) {
      create.push({ ...song, videoPath: winners.video ?? null, audioPath: winners.audio ?? null });
    }
  } else {
    for (const kind of ["video", "audio"] as const) {
      const path = winners[kind];
      if (path) attach.push({ ...song, cardId: existing.id, kind, path });
    }
  }
  return { create, attach, skipped };
}

export function planLibraryScan(input: LibraryScanInput): LibraryScanPlan {
  const used = new Set<string>();
  for (const c of input.cards) {
    if (c.localVideoPath) used.add(normalizePath(c.localVideoPath));
    if (c.localAudioPath) used.add(normalizePath(c.localAudioPath));
  }

  const songsByKey = new Map<string, ScanSong[]>();
  for (const song of input.songs) {
    const key = matchKey(song);
    songsByKey.set(key, [...(songsByKey.get(key) ?? []), song]);
  }
  const cardBySong = new Map(input.cards.map((c) => [c.songId, c]));

  let scannedFiles = 0;
  let alreadyUsed = 0;
  const skipped: RecoverSkip[] = [];
  const candidates = new Map<number, Candidate[]>();

  for (const path of input.files) {
    const kind = clipKindForFile(path);
    if (!kind) continue;
    scannedFiles += 1;
    if (used.has(normalizePath(path))) {
      alreadyUsed += 1;
      continue;
    }
    const { key, copy } = parseFileKey(path);
    const matches = songsByKey.get(key) ?? [];
    if (matches.length !== 1) {
      skipped.push({ path, reason: matches.length ? "ambiguous" : "unmatched", songTitle: null });
      continue;
    }
    const songId = matches[0]!.songId;
    candidates.set(songId, [...(candidates.get(songId) ?? []), { path, kind, copy }]);
  }

  const songById = new Map(input.songs.map((s) => [s.songId, s]));
  const create: RecoverCreate[] = [];
  const attach: RecoverAttach[] = [];
  for (const [songId, files] of candidates) {
    const outcome = resolveSong(songById.get(songId)!, files, cardBySong.get(songId));
    create.push(...outcome.create);
    attach.push(...outcome.attach);
    skipped.push(...outcome.skipped);
  }

  const byName = (a: ScanSong, b: ScanSong) =>
    a.animeTitleRomaji.localeCompare(b.animeTitleRomaji) || a.themeSlot.localeCompare(b.themeSlot);
  create.sort(byName);
  attach.sort(byName);
  skipped.sort((a, b) => a.reason.localeCompare(b.reason) || a.path.localeCompare(b.path));

  return { scannedFiles, alreadyUsed, create, attach, skipped };
}

export const RECOVER_MAX_PATHS = 5000;

export interface RecoverResult {
  created: number;
  attached: number;
  skipped: string[];
}

/** Validates a POST /api/cards/recover body, returning an error message when it is unusable. */
export function parseRecoverBody(body: unknown): { paths: string[] } | { error: string } {
  const paths = typeof body === "object" && body !== null ? (body as { paths?: unknown }).paths : undefined;
  if (!Array.isArray(paths) || paths.length === 0) return { error: "paths must be a non-empty array" };
  if (paths.length > RECOVER_MAX_PATHS) return { error: `paths may hold at most ${RECOVER_MAX_PATHS} entries` };
  if (!paths.every((p) => typeof p === "string" && p.length > 0)) return { error: "paths must all be non-empty strings" };
  return { paths };
}

export interface RecoverActions {
  create: { songId: number; videoPath: string | null; audioPath: string | null }[];
  attach: { cardId: number; kind: ClipKind; path: string }[];
  skipped: string[];
}

// Acts only on what a fresh plan still offers, so a stale preview or a crafted
// path can never create a card outside the library or replace a set path.
export function selectRecoverActions(plan: LibraryScanPlan, paths: string[]): RecoverActions {
  const named = new Set(paths.map(normalizePath));
  const taken = new Set<string>();
  const pick = (path: string | null) => {
    if (!path || !named.has(normalizePath(path))) return null;
    taken.add(normalizePath(path));
    return path;
  };

  const create: RecoverActions["create"] = [];
  for (const entry of plan.create) {
    const videoPath = pick(entry.videoPath);
    const audioPath = pick(entry.audioPath);
    if (videoPath || audioPath) create.push({ songId: entry.songId, videoPath, audioPath });
  }
  const attach: RecoverActions["attach"] = [];
  for (const entry of plan.attach) {
    if (pick(entry.path)) attach.push({ cardId: entry.cardId, kind: entry.kind, path: entry.path });
  }
  const skipped = [...new Set(paths)].filter((p) => !taken.has(normalizePath(p)));
  return { create, attach, skipped };
}
