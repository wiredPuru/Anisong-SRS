import { existsSync, statSync } from "node:fs";
import { isAbsolute, normalize, relative } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { mediaLibrarySettings } from "../db/schema.ts";

const SETTINGS_ID = 1;

export function normalizeFolderPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  const normalized = normalize(trimmed);
  if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function validateFolderPath(candidate: string): string | null {
  if (!isAbsolute(candidate)) {
    return "Path must be absolute.";
  }
  if (!existsSync(candidate)) {
    return "Path does not exist.";
  }
  if (!statSync(candidate).isDirectory()) {
    return "Path is not a directory.";
  }
  return null;
}

function saveLibraryPaths(libraryPaths: string[]): void {
  db.insert(mediaLibrarySettings)
    .values({ id: SETTINGS_ID, libraryPaths })
    .onConflictDoUpdate({ target: mediaLibrarySettings.id, set: { libraryPaths } })
    .run();
}

export function getLibraryPaths(): string[] {
  const row = db
    .select()
    .from(mediaLibrarySettings)
    .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
    .get();
  return row?.libraryPaths ?? [];
}

export function getDefaultDownloadFolder(): string | null {
  const row = db
    .select()
    .from(mediaLibrarySettings)
    .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
    .get();
  return row?.defaultDownloadFolder ?? null;
}

export function setDefaultDownloadFolder(rawPath: string): { error: string } | { defaultDownloadFolder: string } {
  const normalized = normalizeFolderPath(rawPath);

  if (!getLibraryPaths().includes(normalized)) {
    return { error: "Default download folder must be one of the configured library folders." };
  }

  db.insert(mediaLibrarySettings)
    .values({ id: SETTINGS_ID, defaultDownloadFolder: normalized })
    .onConflictDoUpdate({ target: mediaLibrarySettings.id, set: { defaultDownloadFolder: normalized } })
    .run();

  return { defaultDownloadFolder: normalized };
}

export function getDailyNewCardLimit(): number | null {
  const row = db
    .select()
    .from(mediaLibrarySettings)
    .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
    .get();
  return row?.dailyNewCardLimit ?? null;
}

export function setDailyNewCardLimit(limit: number | null): { error: string } | { dailyNewCardLimit: number | null } {
  if (limit !== null && (!Number.isInteger(limit) || limit < 0)) {
    return { error: "Daily new card limit must be a non-negative integer or null." };
  }

  db.insert(mediaLibrarySettings)
    .values({ id: SETTINGS_ID, dailyNewCardLimit: limit })
    .onConflictDoUpdate({ target: mediaLibrarySettings.id, set: { dailyNewCardLimit: limit } })
    .run();

  return { dailyNewCardLimit: limit };
}

export function getBoxOneStreakRequired(): number {
  const row = db
    .select()
    .from(mediaLibrarySettings)
    .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
    .get();
  return row?.boxOneStreakRequired ?? 3;
}

export function setBoxOneStreakRequired(required: number): { error: string } | { boxOneStreakRequired: number } {
  if (!Number.isInteger(required) || required < 1) {
    return { error: "Box one streak requirement must be an integer of at least 1." };
  }

  db.insert(mediaLibrarySettings)
    .values({ id: SETTINGS_ID, boxOneStreakRequired: required })
    .onConflictDoUpdate({ target: mediaLibrarySettings.id, set: { boxOneStreakRequired: required } })
    .run();

  return { boxOneStreakRequired: required };
}

export function getStreamCacheMaxBytes(): number {
  const row = db
    .select()
    .from(mediaLibrarySettings)
    .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
    .get();
  return row?.streamCacheMaxBytes ?? 1_073_741_824;
}

export function setStreamCacheMaxBytes(maxBytes: number): { error: string } | { streamCacheMaxBytes: number } {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    return { error: "Cache size must be a positive integer number of bytes." };
  }

  db.insert(mediaLibrarySettings)
    .values({ id: SETTINGS_ID, streamCacheMaxBytes: maxBytes })
    .onConflictDoUpdate({ target: mediaLibrarySettings.id, set: { streamCacheMaxBytes: maxBytes } })
    .run();

  return { streamCacheMaxBytes: maxBytes };
}

export function getPlaybackMode(): "auto" | "audioOnly" {
  const row = db
    .select()
    .from(mediaLibrarySettings)
    .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
    .get();
  return row?.playbackMode ?? "auto";
}

export function setPlaybackMode(mode: string): { error: string } | { playbackMode: "auto" | "audioOnly" } {
  if (mode !== "auto" && mode !== "audioOnly") {
    return { error: "Playback mode must be 'auto' or 'audioOnly'." };
  }

  db.insert(mediaLibrarySettings)
    .values({ id: SETTINGS_ID, playbackMode: mode })
    .onConflictDoUpdate({ target: mediaLibrarySettings.id, set: { playbackMode: mode } })
    .run();

  return { playbackMode: mode };
}

export function addLibraryPath(rawPath: string): { error: string } | { libraryPaths: string[] } {
  const normalized = normalizeFolderPath(rawPath);

  const validationError = validateFolderPath(normalized);
  if (validationError) {
    return { error: validationError };
  }

  const current = getLibraryPaths();
  if (current.includes(normalized)) {
    return { error: "This folder is already configured." };
  }

  const libraryPaths = [...current, normalized];
  saveLibraryPaths(libraryPaths);
  return { libraryPaths };
}

export function isPathWithinLibrary(candidatePath: string): boolean {
  return getLibraryPaths().some((libraryPath) => {
    const rel = relative(libraryPath, candidatePath);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
}

export function removeLibraryPath(rawPath: string): string[] {
  const normalized = normalizeFolderPath(rawPath);
  const current = getLibraryPaths();
  const libraryPaths = current.filter((path) => path !== normalized);

  if (libraryPaths.length !== current.length) {
    saveLibraryPaths(libraryPaths);
    if (getDefaultDownloadFolder() === normalized) {
      db.update(mediaLibrarySettings)
        .set({ defaultDownloadFolder: null })
        .where(eq(mediaLibrarySettings.id, SETTINGS_ID))
        .run();
    }
  }

  return libraryPaths;
}
