import {
  ROLLING_WINDOW_DAYS,
  getCollectionHealth,
  getOverallStats,
  getDeckTrends,
  getRetentionStats,
  getReviewForecast,
  getReviewHeatmap,
  getReviewTimeline,
  getStudyRecords,
  getStudyRhythm,
  getTroubleCards,
  getWeekOverWeek,
  listAnimeStats,
  listArtistStats,
  rollingPassRates,
} from "../utils/stats.ts";
import type { ReviewTimelineRange } from "../utils/stats.ts";

const TIMELINE_RANGES: ReviewTimelineRange[] = ["30", "90", "all"];

export default defineEventHandler((event) => {
  const { type, range } = getQuery(event);

  if (type === "overall") {
    return getOverallStats();
  }
  if (type === "artist") {
    return { stats: listArtistStats() };
  }
  if (type === "anime") {
    return { stats: listAnimeStats() };
  }
  if (type === "collection") {
    return getCollectionHealth();
  }
  if (type === "forecast") {
    return getReviewForecast();
  }
  if (type === "retention") {
    return getRetentionStats();
  }
  if (type === "trends") {
    return { weekOverWeek: getWeekOverWeek(), ...getDeckTrends() };
  }
  if (type === "heatmap") {
    return getReviewHeatmap();
  }
  if (type === "records") {
    return getStudyRecords();
  }
  if (type === "rhythm") {
    return getStudyRhythm();
  }
  if (type === "trouble") {
    return getTroubleCards();
  }
  if (type === "timeline") {
    if (typeof range !== "string" || !TIMELINE_RANGES.includes(range as ReviewTimelineRange)) {
      throw createError({ statusCode: 400, statusMessage: "range must be '30', '90', or 'all'" });
    }
    const entries = getReviewTimeline(range as ReviewTimelineRange);
    return { entries, rolling: rollingPassRates(entries, ROLLING_WINDOW_DAYS) };
  }

  throw createError({
    statusCode: 400,
    statusMessage:
      "type must be 'overall', 'artist', 'anime', 'timeline', 'collection', 'forecast', 'retention', 'trends', 'heatmap', 'records', 'rhythm', or 'trouble'",
  });
});
