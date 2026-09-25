import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import { fetchAniListCompletedList, fetchAniListIdsByMalIds } from "../lib/anilist.ts";
import { fetchMalCompletedList } from "../lib/mal.ts";
import type { ListSite } from "./studyFilters.ts";

export interface ListAnimeResult {
  aniListIds: number[];
  listSize: number;
  matched: number;
}

export interface ListDeps {
  aniListCompleted: (username: string) => Promise<{ aniListId: number }[]>;
  malCompleted: (username: string) => Promise<{ malId: number }[]>;
  aniListIdsByMalIds: (malIds: number[]) => Promise<Map<number, number>>;
}

const LIVE_DEPS: ListDeps = {
  aniListCompleted: fetchAniListCompletedList,
  malCompleted: (username) => fetchMalCompletedList(username),
  aniListIdsByMalIds: fetchAniListIdsByMalIds,
};

async function listAniListIds(site: ListSite, username: string, deps: ListDeps): Promise<{ ids: Set<number>; listSize: number }> {
  if (site === "anilist") {
    const entries = await deps.aniListCompleted(username);
    return { ids: new Set(entries.map((entry) => entry.aniListId)), listSize: entries.length };
  }
  const entries = await deps.malCompleted(username);
  const mapping = await deps.aniListIdsByMalIds([...new Set(entries.map((entry) => entry.malId))]);
  return { ids: new Set(mapping.values()), listSize: entries.length };
}

// Keeps only anime already in the library with a card, so the stored filter
// stays small however long the user's list is (feature 76c).
export async function resolveListAnimeIds(site: ListSite, username: string, deps: ListDeps = LIVE_DEPS): Promise<ListAnimeResult> {
  const { ids, listSize } = await listAniListIds(site, username, deps);
  const withCards = db.selectDistinct({ id: song.animeId }).from(song).innerJoin(card, eq(card.songId, song.id));
  const aniListIds = db
    .select({ aniListId: anime.aniListId })
    .from(anime)
    .where(inArray(anime.id, withCards))
    .all()
    .map((row) => row.aniListId)
    .filter((id) => ids.has(id))
    .sort((a, b) => a - b);
  return { aniListIds, listSize, matched: aniListIds.length };
}
