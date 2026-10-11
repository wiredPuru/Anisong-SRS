import { and, asc, count, eq, isNotNull, or } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { scopeFilter, type StudyScope } from "./cards.ts";
import type { EndlessCandidate } from "./partyEndless.ts";
import { PARTY_LOAD_MAX } from "./partyGame.ts";
import { parseStudyFilters, studyFilterCondition, type StudyFilters } from "./studyFilters.ts";
import { orderByMix, typeOfSlot } from "./themeMix.ts";

export interface PartySource {
  scope: StudyScope;
  filters: StudyFilters | null;
  shuffle: boolean;
  downloadedOnly: boolean;
}

export function parsePartySource(body: unknown): PartySource | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "A source object is required" };
  const { scope, filters, shuffle, downloadedOnly } = body as {
    scope?: unknown;
    filters?: unknown;
    shuffle?: unknown;
    downloadedOnly?: unknown;
  };

  if (typeof scope !== "object" || scope === null) return { error: "scope is required" };
  const { type, id } = scope as { type?: unknown; id?: unknown };
  let parsedScope: StudyScope;
  if (type === "all") {
    parsedScope = { type };
  } else if (type === "artist" || type === "anime" || type === "created") {
    if (!Number.isInteger(id) || (id as number) <= 0) return { error: "scope.id must be a positive integer" };
    parsedScope = { type, id: id as number };
  } else {
    return { error: "scope.type must be 'all', 'artist', 'anime', or 'created'" };
  }

  const parsedFilters = parseStudyFilters(filters);
  if ("error" in parsedFilters) return parsedFilters;
  if (shuffle !== undefined && typeof shuffle !== "boolean") return { error: "shuffle must be a boolean" };
  if (downloadedOnly !== undefined && typeof downloadedOnly !== "boolean") return { error: "downloadedOnly must be a boolean" };

  return {
    scope: parsedScope,
    filters: parsedFilters.filters,
    shuffle: shuffle === true,
    downloadedOnly: downloadedOnly === true,
  };
}

/**
 * Every card in the scope that passes the filters, due or not. Downloaded-only
 * counts a card by its stored local path; the load step also drops one whose
 * file has since gone missing.
 */
export function listPartyCardIds(scope: StudyScope, filters: StudyFilters | null, downloadedOnly = false): number[] {
  return listPartyCards(scope, filters, downloadedOnly).map((row) => row.id);
}

export function listPartyCards(
  scope: StudyScope,
  filters: StudyFilters | null,
  downloadedOnly = false,
): { id: number; themeSlot: string }[] {
  const downloaded = downloadedOnly ? or(isNotNull(card.localVideoPath), isNotNull(card.localAudioPath)) : undefined;
  return db
    .select({ id: card.id, themeSlot: song.themeSlot })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(scopeFilter(scope), studyFilterCondition(filters), downloaded))
    .orderBy(asc(anime.titleRomaji), asc(song.themeSlot))
    .all();
}

/** Card ids in play order; with a theme mix the order follows its ratio, shuffled within each type. */
export function listPartyQueueIds(
  scope: StudyScope,
  filters: StudyFilters | null,
  downloadedOnly: boolean,
  shuffle: boolean,
  random: () => number = Math.random,
): { cardIds: number[]; total: number } {
  const cards = listPartyCards(scope, filters, downloadedOnly);
  const mix = filters?.themeMix ?? null;
  if (!mix) return pickPartyQueue(cards.map((row) => row.id), shuffle, random);
  const shuffled = pickPartyQueue(cards.map((row) => row.id), shuffle, random, Infinity).cardIds;
  const slots = new Map(cards.map((row) => [row.id, row.themeSlot]));
  const ordered = orderByMix(shuffled, (id) => typeOfSlot(slots.get(id) ?? ""), mix, random);
  return { cardIds: ordered.slice(0, PARTY_LOAD_MAX), total: ordered.length };
}

export function countLibraryCards(): number {
  return db.select({ n: count() }).from(card).get()?.n ?? 0;
}

export function pickPartyQueue(
  ids: number[],
  shuffle: boolean,
  random: () => number = Math.random,
  limit: number = PARTY_LOAD_MAX,
): { cardIds: number[]; total: number } {
  const ordered = [...ids];
  if (shuffle) {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
    }
  }
  return { cardIds: ordered.slice(0, limit), total: ids.length };
}

/** Every card in the scope that passes the filters, with the anime's AniList popularity and whether it has a local file, for endless queues. */
export function listEndlessCandidates(scope: StudyScope = { type: "all" }, filters: StudyFilters | null = null): EndlessCandidate[] {
  return db
    .select({
      cardId: card.id,
      animeId: anime.id,
      popularity: anime.popularity,
      localVideoPath: card.localVideoPath,
      localAudioPath: card.localAudioPath,
    })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(scopeFilter(scope), studyFilterCondition(filters)))
    .all()
    .map(({ localVideoPath, localAudioPath, ...rest }) => ({ ...rest, downloaded: Boolean(localVideoPath || localAudioPath) }));
}
