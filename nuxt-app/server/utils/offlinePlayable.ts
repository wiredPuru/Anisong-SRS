import { existsSync, statSync } from "node:fs";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { isClipUrlAllowed } from "./clipSource.ts";
import { getClipSource, getOfflineMode, getPlayableOfflineOnly, isPathWithinLibrary } from "./mediaLibrary.ts";
import { isStreamCached } from "./streamCache.ts";

export interface PlayableSources {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}

export interface PlayableChecks {
  localFileUsable: (path: string) => boolean;
  clipAllowed: (url: string) => boolean;
  clipCached: (url: string) => boolean;
}

// A card plays offline when any one source does: a local file the media route
// would serve, or a remote clip whose complete copy is in the stream cache.
export function isCardPlayableOffline(sources: PlayableSources, checks: PlayableChecks): boolean {
  const locals = [sources.localVideoPath, sources.localAudioPath];
  if (locals.some((path) => path !== null && checks.localFileUsable(path))) return true;
  const remotes = [sources.animethemesVideoUrl, sources.animethemesAudioUrl];
  return remotes.some((url) => url !== null && checks.clipAllowed(url) && checks.clipCached(url));
}

function liveChecks(): PlayableChecks {
  const clipSource = getClipSource();
  return {
    localFileUsable: (path) => isPathWithinLibrary(path) && existsSync(path) && statSync(path).isFile(),
    clipAllowed: (url) => isClipUrlAllowed(url, clipSource),
    clipCached: isStreamCached,
  };
}

// The scan stats every local path, and one Study request asks several times.
const MEMO_MS = 3000;
let memo: { at: number; ids: number[]; total: number } | null = null;

export function scanOfflinePlayable(now = Date.now()): { ids: number[]; total: number } {
  if (memo && now - memo.at < MEMO_MS) return memo;
  const checks = liveChecks();
  const rows = db
    .select({
      id: card.id,
      localVideoPath: card.localVideoPath,
      localAudioPath: card.localAudioPath,
      animethemesVideoUrl: card.animethemesVideoUrl,
      animethemesAudioUrl: card.animethemesAudioUrl,
    })
    .from(card)
    .all();
  const ids = rows.filter((row) => isCardPlayableOffline(row, checks)).map((row) => row.id);
  memo = { at: now, ids, total: rows.length };
  return memo;
}

export function resetOfflinePlayableMemo(): void {
  memo = null;
}

// Only while Offline mode is on: online, the choice is ignored so it can never
// hide cards from a user who has gone back online.
export function offlinePlayableFilterActive(): boolean {
  return getOfflineMode() && getPlayableOfflineOnly();
}

// Library-wide, not per scope or filter: the number to tell the user.
export function offlineHiddenCount(): number {
  if (!offlinePlayableFilterActive()) return 0;
  const { ids, total } = scanOfflinePlayable();
  return total - ids.length;
}

// json_each over one bound parameter instead of an IN list, which SQLite caps
// in the thousands.
export function offlinePlayableCondition(): SQL | undefined {
  if (!offlinePlayableFilterActive()) return undefined;
  return sql`${card.id} IN (SELECT value FROM json_each(${JSON.stringify(scanOfflinePlayable().ids)}))`;
}
