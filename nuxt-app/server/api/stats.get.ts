import {
  ROLLING_WINDOW_DAYS,
  getCollectionHealth,
  getOverallStats,
  getAvailableTracks,
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
import { parseStatsTrack } from "../utils/statsTrack.ts";

const TIMELINE_RANGES: ReviewTimelineRange[] = ["30", "90", "all"];

export default defineEventHandler((event) => {
  const { type, range, track: trackRaw } = getQuery(event);
  const track = parseStatsTrack(trackRaw);
  if (typeof track !== "string") {
    throw createError({ statusCode: 400, statusMessage: track.error });
  }

  if (type === "tracks") {
    return { tracks: getAvailableTracks() };
  }
  if (type === "overall") {
    return getOverallStats(track);
  }
  if (type === "artist") {
    return { stats: listArtistStats(track) };
  }
  if (type === "anime") {
    return { stats: listAnimeStats(track) };
  }
  if (type === "collection") {
    return getCollectionHealth(track);
  }
  if (type === "forecast") {
    return getReviewForecast(track);
  }
  if (type === "retention") {
    return getRetentionStats(track);
  }
  if (type === "trends") {
    return { weekOverWeek: getWeekOverWeek(track), ...getDeckTrends(track) };
  }
  if (type === "heatmap") {
    return getReviewHeatmap(track);
  }
  if (type === "records") {
    return getStudyRecords(track);
  }
  if (type === "rhythm") {
    return getStudyRhythm(track);
  }
  if (type === "trouble") {
    return getTroubleCards(track);
  }
  if (type === "timeline") {
    if (typeof range !== "string" || !TIMELINE_RANGES.includes(range as ReviewTimelineRange)) {
      throw createError({ statusCode: 400, statusMessage: "range must be '30', '90', or 'all'" });
    }
    const entries = getReviewTimeline(range as ReviewTimelineRange, track);
    return { entries, rolling: rollingPassRates(entries, ROLLING_WINDOW_DAYS) };
  }

  throw createError({
    statusCode: 400,
    statusMessage:
      "type must be 'tracks', 'overall', 'artist', 'anime', 'timeline', 'collection', 'forecast', 'retention', 'trends', 'heatmap', 'records', 'rhythm', or 'trouble'",
  });
});
