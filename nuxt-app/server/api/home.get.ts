import { getCardMaturityBreakdown, getDueCardBreakdown, listRecentCards } from "../utils/cards.ts";
import { getReviewTimeline, getStudyStreak, getWeakestDecks, summarizeTimeline } from "../utils/stats.ts";

export default defineEventHandler(() => {
  const timeline = getReviewTimeline("30");

  return {
    due: getDueCardBreakdown({ type: "all" }),
    cardMaturity: getCardMaturityBreakdown(),
    streakDays: getStudyStreak(),
    recentReviews: summarizeTimeline(timeline),
    timeline,
    weakestDecks: getWeakestDecks(3, 3),
    recentCards: listRecentCards(3),
  };
});
