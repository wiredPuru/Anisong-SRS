import {
  getDueCardCount,
  getNewCardsTodayInfo,
  getNextDueCard,
  getUpcomingDueCards,
  getWithheldNewCount,
} from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel, getManualDeckLabel } from "../../utils/decks.ts";
import { parseStudyScope } from "../../utils/studyScope.ts";

const NOT_FOUND = { artist: "Artist not found", anime: "Anime not found", created: "Deck not found" } as const;

export default defineEventHandler((event) => {
  const { type, id: idRaw, includeNew } = getQuery(event);
  // Session-only opt-in from Study's "Study new cards" action; anything other
  // than the literal "true" leaves the daily cap in force.
  const includeNewBeyondLimit = includeNew === "true";

  const parsed = parseStudyScope(type, idRaw);
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  const { scope } = parsed;

  if (scope.type !== "all") {
    const lookup = { artist: getArtistLabel, anime: getAnimeLabel, created: getManualDeckLabel }[scope.type];
    if (lookup(scope.id) === undefined) {
      throw createError({ statusCode: 404, statusMessage: NOT_FOUND[scope.type] });
    }
  }

  const nextCard = getNextDueCard(scope, includeNewBeyondLimit);

  return {
    card: nextCard ?? null,
    newCardsToday: getNewCardsTodayInfo(),
    dueCount: getDueCardCount(scope, includeNewBeyondLimit),
    withheldNewCount: getWithheldNewCount(scope),
    upcoming: getUpcomingDueCards(scope, nextCard?.id, 2, includeNewBeyondLimit),
  };
});
