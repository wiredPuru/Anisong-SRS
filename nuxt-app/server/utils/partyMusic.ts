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

// A download is named "<anime> - <slot> - <artist>", and playing those between
// songs would give the answers away, so library folders skip them.
const DOWNLOADED_CLIP = / - (OP|ED|IN)[\w-]* - /i;
const LIBRARY_MUSIC_SUBFOLDER = "party-music";

export interface PartyMusicTrack {
  name: string;
  path: string;
}

function audioIn(folder: string, skip: (name: string) => boolean): PartyMusicTrack[] {
  try {
    return readdirSync(folder)
      .filter((name) => isMusicFile(name) && !skip(name) && statSync(join(folder, name)).isFile())
      .map((name) => ({ name, path: join(folder, name) }));
  } catch {
    return [];
  }
}

// Read fresh on every call, so tracks dropped in mid-event join the rotation.
// Sources: the party-music folder beside the database, plus every media
// library folder from Settings (its audio files, and any party-music folder
// inside it).
export function listPartyMusic(libraryFolders: readonly string[] = []): { folder: string; folders: string[]; tracks: string[]; files: PartyMusicTrack[] } {
  const folder = partyMusicFolder();
  try {
    mkdirSync(folder, { recursive: true });
  } catch {
    // An unwritable folder just means no tracks from it.
  }
  const sources = [folder, ...libraryFolders, ...libraryFolders.map((dir) => join(dir, LIBRARY_MUSIC_SUBFOLDER))];
  const seen = new Set<string>();
  const files: PartyMusicTrack[] = [];
  for (const source of sources) {
    const isLibrary = source !== folder && !source.endsWith(LIBRARY_MUSIC_SUBFOLDER);
    for (const track of audioIn(source, (name) => isLibrary && (extname(name).toLowerCase() === ".webm" || DOWNLOADED_CLIP.test(name)))) {
      if (!seen.has(track.path)) {
        seen.add(track.path);
        files.push(track);
      }
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { folder, folders: [folder, ...libraryFolders], tracks: files.map((file) => file.name), files };
}
