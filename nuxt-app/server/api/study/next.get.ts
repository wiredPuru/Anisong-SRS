import {
  getDueCardCount,
  getNewCardsTodayInfo,
  getNextDueCard,
  getUpcomingDueCards,
  getWithheldNewCount,
} from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel, getManualDeckLabel, resolveScopeCriterion } from "../../utils/decks.ts";
import { parseStudyFilters } from "../../utils/studyFilters.ts";
import { parseStudyScope } from "../../utils/studyScope.ts";

const NOT_FOUND = { artist: "Artist not found", anime: "Anime not found", created: "Deck not found" } as const;

export default defineEventHandler((event) => {
  const { type, id: idRaw, includeNew, filters: filtersRaw } = getQuery(event);
  // Session-only opt-in from Study's "Study new cards" action; anything other
  // than the literal "true" leaves the daily cap in force.
  const includeNewBeyondLimit = includeNew === "true";

  const parsed = parseStudyScope(type, idRaw);
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  const { scope } = parsed;

  const parsedFilters = parseStudyFilters(filtersRaw);
  if ("error" in parsedFilters) {
    throw createError({ statusCode: 400, statusMessage: parsedFilters.error });
  }
  const { filters } = parsedFilters;

  if (scope.type !== "all") {
    const lookup = { artist: getArtistLabel, anime: getAnimeLabel, created: getManualDeckLabel }[scope.type];
    if (lookup(scope.id) === undefined) {
      throw createError({ statusCode: 404, statusMessage: NOT_FOUND[scope.type] });
    }
  }

  // Resolved once per request: every count below has to describe the same
  // track as the card being served, and re-reading the deck per call would
  // let a criterion changed mid-request split them.
  const criterion = resolveScopeCriterion(scope);
  const nextCard = getNextDueCard(scope, includeNewBeyondLimit, criterion, filters);

  return {
    card: nextCard ?? null,
    criterion,
    newCardsToday: getNewCardsTodayInfo(criterion),
    dueCount: getDueCardCount(scope, includeNewBeyondLimit, criterion, filters),
    withheldNewCount: getWithheldNewCount(scope, criterion, filters),
    upcoming: getUpcomingDueCards(scope, nextCard?.id, 2, includeNewBeyondLimit, criterion, filters),
  };
});
