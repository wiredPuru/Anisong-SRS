import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { resolveDbPath } from "../db/dataDir.ts";

const MUSIC_EXTENSIONS = new Set([".mp3", ".m4a", ".ogg", ".opus", ".wav", ".webm", ".flac"]);

export function isMusicFile(name: string): boolean {
  return !name.startsWith(".") && MUSIC_EXTENSIONS.has(extname(name).toLowerCase());
}

/** The lobby-music folder beside the database, created on first use. */
export function partyMusicFolder(): string {
  return join(dirname(resolveDbPath(process.env, process.cwd())), "party-music");
}

// Read fresh on every call, so tracks dropped in mid-event join the rotation.
export function listPartyMusic(): { folder: string; tracks: string[] } {
  const folder = partyMusicFolder();
  try {
    mkdirSync(folder, { recursive: true });
    const tracks = readdirSync(folder)
      .filter((name) => isMusicFile(name) && statSync(join(folder, name)).isFile())
      .sort((a, b) => a.localeCompare(b));
    return { folder, tracks };
  } catch {
    return { folder, tracks: [] };
  }
}
