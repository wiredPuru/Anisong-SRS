import type { StudyScope } from "../../utils/cards.ts";
import {
  getDueCardCount,
  getNewCardsTodayInfo,
  getNextDueCard,
  getUpcomingDueCards,
  getWithheldNewCount,
} from "../../utils/cards.ts";
import { getAnimeLabel, getArtistLabel } from "../../utils/decks.ts";

export default defineEventHandler((event) => {
  const { type, id: idRaw, includeNew } = getQuery(event);
  // Session-only opt-in from Study's "Study new cards" action; anything other
  // than the literal "true" leaves the daily cap in force.
  const includeNewBeyondLimit = includeNew === "true";

  if (type !== "all" && type !== "artist" && type !== "anime") {
    throw createError({ statusCode: 400, statusMessage: "type must be 'all', 'artist', or 'anime'" });
  }

  let scope: StudyScope;

  if (type === "all") {
    scope = { type: "all" };
  } else {
    const id = Number(idRaw);
    if (typeof idRaw !== "string" || idRaw.trim() === "" || !Number.isFinite(id)) {
      throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
    }

    const label = type === "artist" ? getArtistLabel(id) : getAnimeLabel(id);
    if (label === undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: type === "artist" ? "Artist not found" : "Anime not found",
      });
    }

    scope = type === "artist" ? { type: "artist", id } : { type: "anime", id };
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
