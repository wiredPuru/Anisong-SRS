import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { scopeFilter, type StudyScope } from "./cards.ts";
import { PARTY_LOAD_MAX } from "./partyGame.ts";
import { parseStudyFilters, studyFilterCondition, type StudyFilters } from "./studyFilters.ts";

export interface PartySource {
  scope: StudyScope;
  filters: StudyFilters | null;
  shuffle: boolean;
}

export function parsePartySource(body: unknown): PartySource | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "A source object is required" };
  const { scope, filters, shuffle } = body as { scope?: unknown; filters?: unknown; shuffle?: unknown };

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

  return { scope: parsedScope, filters: parsedFilters.filters, shuffle: shuffle === true };
}

/** Every card in the scope that passes the filters, due or not. */
export function listPartyCardIds(scope: StudyScope, filters: StudyFilters | null): number[] {
  return db
    .select({ id: card.id })
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(and(scopeFilter(scope), studyFilterCondition(filters)))
    .orderBy(asc(anime.titleRomaji), asc(song.themeSlot))
    .all()
    .map((row) => row.id);
}

export function pickPartyQueue(
  ids: number[],
  shuffle: boolean,
  random: () => number = Math.random,
): { cardIds: number[]; total: number } {
  const ordered = [...ids];
  if (shuffle) {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
    }
  }
  return { cardIds: ordered.slice(0, PARTY_LOAD_MAX), total: ids.length };
}
