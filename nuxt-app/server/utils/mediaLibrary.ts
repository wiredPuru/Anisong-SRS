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
  }

  return libraryPaths;
}
